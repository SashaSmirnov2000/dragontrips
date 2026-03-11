import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const MY_ADMIN_ID = 1920798985;
const SUPPORT_LINK = "https://t.me/dragonservicesupport";
const CATALOG_URL  = "https://dragontrips.vercel.app";

async function tgPost(botToken: string, method: string, body: object) {
  return fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (!botToken) return NextResponse.json({ error: "No Token" }, { status: 500 });

    // ═══════════════════════════════════════════════════════════════
    // БЛОК 0: CALLBACK QUERIES
    // ═══════════════════════════════════════════════════════════════
    if (body.callback_query) {
      const callbackId   = body.callback_query.id;
      const callbackData = body.callback_query.data as string;
      const chatId       = body.callback_query.message.chat.id;
      const messageId    = body.callback_query.message.message_id;
      const oldText      = body.callback_query.message.text || "";

      const answerCallback = () =>
        tgPost(botToken, 'answerCallbackQuery', { callback_query_id: callbackId });

      // ── Клиент отменяет заказ ──────────────────────────────────────────────
      if (callbackData.startsWith('cancel_order_')) {
        const tourId = callbackData.replace('cancel_order_', '');

        const { data: booking } = await supabase
          .from('bookings')
          .select('id, bike_model')
          .eq('telegram_id', chatId)
          .eq('bike_id', tourId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (booking) {
          await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id);
          await tgPost(botToken, 'sendMessage', {
            chat_id: MY_ADMIN_ID,
            text: `❌ *Заказ №${booking.id} отменён клиентом.*\nТур: ${booking.bike_model}`,
            parse_mode: 'Markdown',
          });
        }

        await tgPost(botToken, 'editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text:
            "❌ *Бронирование отменено.*\n\nХотите выбрать другой тур? Каталог всегда открыт!\n\n" +
            "━━━━━━━━━━━━━━━━━\n\n" +
            "❌ *Booking cancelled.*\n\nWant to pick another tour? The catalog is always open!",
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: "🐉 Открыть каталог / Open Catalog", web_app: { url: CATALOG_URL } }]],
          },
        });

        await answerCallback();
        return NextResponse.json({ ok: true });
      }

      // ── Остальные кнопки — только для админа ──────────────────────────────
      if (chatId !== MY_ADMIN_ID) { await answerCallback(); return NextResponse.json({ ok: true }); }

      if (callbackData.startsWith('manage_')) {
        const orderId = callbackData.replace('manage_', '');
        await tgPost(botToken, 'editMessageReplyMarkup', {
          chat_id: chatId, message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Подтвердить",       callback_data: `confirm_${orderId}` }],
              [{ text: "❌ Отменить",           callback_data: `decline_${orderId}` }],
              [{ text: "✉️ Написать клиенту",  callback_data: `ask_msg_${orderId}` }],
            ],
          },
        });
        await answerCallback();
        return NextResponse.json({ ok: true });
      }

      if (callbackData.startsWith('confirm_')) {
        const id = callbackData.replace('confirm_', '');
        const { data: order } = await supabase.from('bookings').select('*').eq('id', id).single();
        if (order && order.status !== 'confirmed') {
          await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', id);
          await tgPost(botToken, 'sendMessage', {
            chat_id: Number(order.telegram_id),
            text:
              "✅ *Отличные новости — тур подтверждён!*\n\n" +
              "Напишите менеджеру, чтобы уточнить детали встречи.\n\n" +
              "━━━━━━━━━━━━━━━━━\n\n" +
              "✅ *Great news — your tour is confirmed!*\n\n" +
              "Message the manager to confirm meeting details.",
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: "✉️ Написать менеджеру / Message manager", url: SUPPORT_LINK }]] },
          });
          await tgPost(botToken, 'editMessageText', {
            chat_id: MY_ADMIN_ID, message_id: messageId,
            text: oldText + "\n\n✅ *СТАТУС: ПОДТВЕРЖДЕНО*", parse_mode: 'Markdown',
          });
        }
        await answerCallback();
        return NextResponse.json({ ok: true });
      }

      if (callbackData.startsWith('decline_')) {
        const id = callbackData.replace('decline_', '');
        const { data: order } = await supabase.from('bookings').select('*').eq('id', id).single();
        if (order && order.status !== 'unavailable') {
          await supabase.from('bookings').update({ status: 'unavailable' }).eq('id', id);
          await tgPost(botToken, 'sendMessage', {
            chat_id: Number(order.telegram_id),
            text:
              "😔 *К сожалению, этот тур уже занят на выбранную дату.*\n\n" +
              "Напишите менеджеру — подберём другой вариант!\n\n" +
              "━━━━━━━━━━━━━━━━━\n\n" +
              "😔 *Sorry, this tour is fully booked for that date.*\n\n" +
              "Message the manager — we'll find a great alternative!",
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: "🤝 Написать менеджеру / Message manager", url: SUPPORT_LINK }]] },
          });
          await tgPost(botToken, 'editMessageText', {
            chat_id: MY_ADMIN_ID, message_id: messageId,
            text: oldText + "\n\n❌ *СТАТУС: НЕТ МЕСТ*", parse_mode: 'Markdown',
          });
        }
        await answerCallback();
        return NextResponse.json({ ok: true });
      }

      if (callbackData.startsWith('ask_msg_')) {
        const id = callbackData.replace('ask_msg_', '');
        await tgPost(botToken, 'sendMessage', {
          chat_id: MY_ADMIN_ID,
          text: `📝 Напишите сообщение для заказа №${id}:\n(Используйте ОТВЕТ/REPLY на это сообщение)`,
          reply_markup: { force_reply: true, selective: true },
        });
        await answerCallback();
        return NextResponse.json({ ok: true });
      }

      await answerCallback();
      return NextResponse.json({ ok: true });
    }

    // ═══════════════════════════════════════════════════════════════
    // БЛОК 1: ТЕКСТОВЫЕ СООБЩЕНИЯ (webhook forward)
    // ═══════════════════════════════════════════════════════════════
    if (body.message) {
      const chatId = body.message.chat.id;
      const text   = body.message.text || '';

      // Ответ админа через reply
      if (chatId === MY_ADMIN_ID && body.message.reply_to_message) {
        const replyText = body.message.reply_to_message.text || "";
        const idMatch   = replyText.match(/(?:№|заказа\s+)(\d+)/i);
        if (idMatch && text.trim().length > 0) {
          const orderId = idMatch[1];
          const { data: order } = await supabase.from('bookings').select('telegram_id').eq('id', orderId).single();
          if (order?.telegram_id) {
            await tgPost(botToken, 'sendMessage', {
              chat_id: Number(order.telegram_id),
              text: `💬 *Сообщение от менеджера / Message from manager:*\n\n${text}`,
              parse_mode: 'Markdown',
            });
            await tgPost(botToken, 'sendMessage', { chat_id: MY_ADMIN_ID, text: `✅ Доставлено клиенту (заказ №${orderId})` });
            return NextResponse.json({ ok: true });
          }
        }
      }

      return NextResponse.json({ ok: true });
    }

    // ═══════════════════════════════════════════════════════════════
    // БЛОК 2: НОВЫЙ ЗАКАЗ из веб-приложения
    // ═══════════════════════════════════════════════════════════════
    const { bike_model, start_date, end_date, client_username, telegram_id, bike_id, total_price } = body;

    if (bike_model && telegram_id) {
      // Подтягиваем реферала из таблицы users если есть
      let finalReferrer = body.referrer;
      const { data: userData } = await supabase
        .from('users').select('referrer').eq('telegram_id', telegram_id).single();
      if (userData?.referrer) finalReferrer = userData.referrer;

      // Сохраняем заказ
      const { data: newOrder } = await supabase
        .from('bookings')
        .insert([{
          bike_id, bike_model,
          start_date, end_date: end_date || start_date,  // тур — одна дата
          client_username, telegram_id,
          status: 'pending', total_price,
          referrer: finalReferrer,
        }])
        .select().single();

      // Уведомление админу
      await tgPost(botToken, 'sendMessage', {
        chat_id: MY_ADMIN_ID,
        text:
          `🔔 *НОВЫЙ ТУР №${newOrder?.id}*\n\n` +
          `🐉 *Тур:* ${bike_model}\n` +
          `📅 *Дата:* ${start_date}\n` +
          `💰 *Стоимость:* ${total_price || '—'}\n` +
          `👤 *Клиент:* @${client_username}\n` +
          `🔗 *Реферал:* ${finalReferrer || 'Прямой заход'}`,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: "⚙️ Управлять заказом", callback_data: `manage_${newOrder?.id}` }]] },
      });

      // Уведомление клиенту
      await tgPost(botToken, 'sendMessage', {
        chat_id: Number(telegram_id),
        text:
          "✅ *Заявка принята — уже обрабатываем!*\n\n" +
          `🐉 Тур: *${bike_model}*\n` +
          `📅 Дата: ${start_date}\n` +
          `💰 Стоимость: ${total_price || '—'}\n\n` +
          "Как только подтвердим — сразу пришлём уведомление сюда.\n\n" +
          "🕒 Время обработки: 09:00 — 21:00 (местное время)\n" +
          "🆘 Поддержка: @dragonservicesupport\n\n" +
          "━━━━━━━━━━━━━━━━━\n\n" +
          "✅ *Booking received — processing now!*\n\n" +
          `🐉 Tour: *${bike_model}*\n` +
          `📅 Date: ${start_date}\n` +
          `💰 Price: ${total_price || '—'}\n\n` +
          "Once confirmed, we'll notify you right here.\n\n" +
          "🕒 Hours: 9:00 AM — 9:00 PM (local time)\n" +
          "🆘 Support: @dragonservicesupport",
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: "🤝 Связаться с менеджером / Support", url: SUPPORT_LINK }],
            [{ text: "❌ Отменить бронирование / Cancel",   callback_data: `cancel_order_${bike_id}` }],
          ],
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}