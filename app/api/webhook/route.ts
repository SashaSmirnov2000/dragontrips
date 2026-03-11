import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const MY_ADMIN_ID = 1920798985;
const SUPPORT_LINK = "https://t.me/dragonservicesupport";
const CATALOG_URL  = "https://dragontrips.vercel.app";
const CHANNEL      = "@dragonindanang";

async function tgPost(botToken: string, method: string, body: object) {
  return fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function checkSubscription(botToken: string, userId: number): Promise<boolean> {
  try {
    const res  = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHANNEL, user_id: userId }),
    });
    const data = await res.json();
    if (!data.ok) return false;
    const status = data.result?.status;
    if (status === 'left' || status === 'kicked') return false;
    return ['member', 'administrator', 'creator'].includes(status);
  } catch { return false; }
}

// ─────────────────────────────────────────────────────────────────────────────
// ТЕКСТЫ
// ─────────────────────────────────────────────────────────────────────────────

const MSG_NOT_SUBSCRIBED =
  "🐉 *Один шаг до приключения!*\n\n" +
  "Подпишитесь на наш канал — это быстро и бесплатно.\n" +
  "После подписки сразу откроется каталог туров.\n\n" +
  "━━━━━━━━━━━━━━━━━\n\n" +
  "🐉 *One step to your adventure!*\n\n" +
  "Subscribe to our channel — it's quick and free.\n" +
  "After subscribing, the tour catalog will open instantly.";

const MSG_WELCOME_CATALOG =
  "✅ *Подписка подтверждена — добро пожаловать!*\n\n" +
  "Открывайте каталог и бронируйте тур прямо сейчас.\n\n" +
  "🆘 Поддержка: @dragonservicesupport\n\n" +
  "━━━━━━━━━━━━━━━━━\n\n" +
  "✅ *Subscription confirmed — welcome aboard!*\n\n" +
  "Open the catalog and book your tour right now.\n\n" +
  "🆘 Support: @dragonservicesupport";

const MSG_START_NOT_SUBSCRIBED =
  "🌴 *Привет! Это Dragon Trips — туры в Дананге.*\n\n" +
  "Однодневные приключения, море, горы, город.\n" +
  "Всё просто:\n\n" +
  "• Выбираете тур из каталога\n" +
  "• Бронируете в один клик\n" +
  "• Наслаждаетесь поездкой\n\n" +
  "Чтобы открыть каталог, подпишитесь на наш канал 👇\n\n" +
  "━━━━━━━━━━━━━━━━━\n\n" +
  "🌴 *Hey! This is Dragon Trips — tours in Da Nang.*\n\n" +
  "One-day adventures: sea, mountains, city.\n" +
  "It's all super simple:\n\n" +
  "• Pick a tour from the catalog\n" +
  "• Book in one click\n" +
  "• Enjoy the experience\n\n" +
  "To open the catalog, subscribe to our channel 👇";

const MSG_START_SUBSCRIBED =
  "🌴 *Привет! Это Dragon Trips — туры в Дананге.*\n\n" +
  "Однодневные приключения, море, горы, город.\n" +
  "Всё просто:\n\n" +
  "• Выбираете тур из каталога\n" +
  "• Бронируете в один клик\n" +
  "• Наслаждаетесь поездкой\n\n" +
  "🆘 Поддержка: @dragonservicesupport\n\n" +
  "━━━━━━━━━━━━━━━━━\n\n" +
  "🌴 *Hey! This is Dragon Trips — tours in Da Nang.*\n\n" +
  "One-day adventures: sea, mountains, city.\n" +
  "It's all super simple:\n\n" +
  "• Pick a tour from the catalog\n" +
  "• Book in one click\n" +
  "• Enjoy the experience\n\n" +
  "🆘 Support: @dragonservicesupport";

const MSG_BOOKING_CANCELLED =
  "❌ *Бронирование отменено.*\n\n" +
  "Хотите выбрать другой тур? Каталог всегда открыт!\n\n" +
  "━━━━━━━━━━━━━━━━━\n\n" +
  "❌ *Booking cancelled.*\n\n" +
  "Want to pick another tour? The catalog is always open!";

const MSG_BOOKING_CONFIRMED =
  "✅ *Тур подтверждён и ждёт вас!*\n\n" +
  "Напишите менеджеру — он пришлёт все детали о встрече.\n\n" +
  "━━━━━━━━━━━━━━━━━\n\n" +
  "✅ *Your tour is confirmed and ready!*\n\n" +
  "Message the manager — they'll send you all the meeting details.";

const MSG_BOOKING_UNAVAILABLE =
  "😔 *К сожалению, этот тур занят на выбранную дату.*\n\n" +
  "Напишите менеджеру — подберём похожий вариант!\n\n" +
  "━━━━━━━━━━━━━━━━━\n\n" +
  "😔 *Sorry, this tour is fully booked for that date.*\n\n" +
  "Message the manager — we'll find a great alternative!";

const MSG_FALLBACK =
  "👋 *Не совсем понял ваш запрос.*\n\n" +
  "Пользуйтесь кнопками меню — так быстрее.\n" +
  "Отправляю стартовое меню 👇\n\n" +
  "━━━━━━━━━━━━━━━━━\n\n" +
  "👋 *Hmm, I didn't quite get that.*\n\n" +
  "Please use the menu buttons — it's faster.\n" +
  "Sending you the main menu now 👇";

// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body  = await req.json();
    const token = process.env.TELEGRAM_BOT_TOKEN!;

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (!token) return NextResponse.json({ error: "No Token" }, { status: 500 });

    // ═══════════════════════════════════════════════════════════════
    // БЛОК 1: CALLBACK QUERIES
    // ═══════════════════════════════════════════════════════════════
    if (body.callback_query) {
      const callbackId   = body.callback_query.id;
      const callbackData = body.callback_query.data as string;
      const chatId       = body.callback_query.message.chat.id;
      const messageId    = body.callback_query.message.message_id;
      const oldText      = body.callback_query.message.text || "";

      const answerCallback = () =>
        tgPost(token, 'answerCallbackQuery', { callback_query_id: callbackId });

      // ── check_sub: проверка подписки ──────────────────────────────────────
      if (callbackData === 'check_sub') {
        const userId = body.callback_query.from.id;
        const isSubscribed = await checkSubscription(token, userId);

        if (!isSubscribed) {
          await answerCallback();
          await tgPost(token, 'sendMessage', {
            chat_id: chatId, text: MSG_NOT_SUBSCRIBED, parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [
              [{ text: "📢 Подписаться / Subscribe", url: `https://t.me/${CHANNEL.replace('@','')}` }],
              [{ text: "🔄 Проверить / Check", callback_data: "check_sub" }],
            ]},
          });
          return NextResponse.json({ ok: true });
        }

        await answerCallback();
        await tgPost(token, 'sendMessage', {
          chat_id: chatId, text: MSG_WELCOME_CATALOG, parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "🐉 Открыть каталог / Open Catalog", web_app: { url: CATALOG_URL } }]] },
        });
        return NextResponse.json({ ok: true });
      }

      // ── cancel_order_{tourId}: клиент отменяет ────────────────────────────
      if (callbackData.startsWith('cancel_order_')) {
        const tourId = callbackData.replace('cancel_order_', '');

        const { data: booking } = await supabaseAdmin
          .from('bookings')
          .select('id, bike_model')
          .eq('telegram_id', chatId)
          .eq('bike_id', tourId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (booking) {
          await supabaseAdmin.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id);
          await tgPost(token, 'sendMessage', {
            chat_id: MY_ADMIN_ID,
            text: `❌ *Заказ №${booking.id} отменён клиентом.*\nТур: ${booking.bike_model}`,
            parse_mode: 'Markdown',
          });
        }

        await tgPost(token, 'editMessageText', {
          chat_id: chatId, message_id: messageId,
          text: MSG_BOOKING_CANCELLED, parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: "🐉 Открыть каталог / Open Catalog", web_app: { url: CATALOG_URL } }]] },
        });

        await answerCallback();
        return NextResponse.json({ ok: true });
      }

      // ── Остальные — только для админа ─────────────────────────────────────
      if (chatId !== MY_ADMIN_ID) { await answerCallback(); return NextResponse.json({ ok: true }); }

      if (callbackData.startsWith('manage_')) {
        const orderId = callbackData.replace('manage_', '');
        await tgPost(token, 'editMessageReplyMarkup', {
          chat_id: chatId, message_id: messageId,
          reply_markup: { inline_keyboard: [
            [{ text: "✅ Подтвердить",      callback_data: `confirm_${orderId}` }],
            [{ text: "❌ Нет мест",         callback_data: `decline_${orderId}` }],
            [{ text: "✉️ Написать клиенту", callback_data: `ask_msg_${orderId}` }],
          ]},
        });
        await answerCallback();
        return NextResponse.json({ ok: true });
      }

      if (callbackData.startsWith('confirm_')) {
        const id = callbackData.replace('confirm_', '');
        const { data: order } = await supabaseAdmin.from('bookings').select('*').eq('id', id).single();
        if (order && order.status !== 'confirmed') {
          await supabaseAdmin.from('bookings').update({ status: 'confirmed' }).eq('id', id);
          await tgPost(token, 'sendMessage', {
            chat_id: Number(order.telegram_id),
            text: MSG_BOOKING_CONFIRMED, parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: "✉️ Написать менеджеру / Message manager", url: SUPPORT_LINK }]] },
          });
          await tgPost(token, 'editMessageText', {
            chat_id: MY_ADMIN_ID, message_id: messageId,
            text: oldText + "\n\n✅ *СТАТУС: ПОДТВЕРЖДЕНО*", parse_mode: 'Markdown',
          });
        }
        await answerCallback();
        return NextResponse.json({ ok: true });
      }

      if (callbackData.startsWith('decline_')) {
        const id = callbackData.replace('decline_', '');
        const { data: order } = await supabaseAdmin.from('bookings').select('*').eq('id', id).single();
        if (order && order.status !== 'unavailable') {
          await supabaseAdmin.from('bookings').update({ status: 'unavailable' }).eq('id', id);
          await tgPost(token, 'sendMessage', {
            chat_id: Number(order.telegram_id),
            text: MSG_BOOKING_UNAVAILABLE, parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: "🤝 Написать менеджеру / Message manager", url: SUPPORT_LINK }]] },
          });
          await tgPost(token, 'editMessageText', {
            chat_id: MY_ADMIN_ID, message_id: messageId,
            text: oldText + "\n\n❌ *СТАТУС: НЕТ МЕСТ*", parse_mode: 'Markdown',
          });
        }
        await answerCallback();
        return NextResponse.json({ ok: true });
      }

      if (callbackData.startsWith('ask_msg_')) {
        const id = callbackData.replace('ask_msg_', '');
        await tgPost(token, 'sendMessage', {
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
    // БЛОК 2: ТЕКСТОВЫЕ СООБЩЕНИЯ
    // ═══════════════════════════════════════════════════════════════
    if (body.message) {
      const chatId   = body.message.chat.id;
      const text     = body.message.text || '';
      const userId   = body.message.from?.id;
      const username = body.message.from?.username || "anonymous";

      // ── Reply-ответ админа → клиенту ──────────────────────────────────────
      if (chatId === MY_ADMIN_ID && body.message.reply_to_message) {
        const replyText = body.message.reply_to_message.text || "";
        const idMatch   = replyText.match(/(?:№|заказа\s+)(\d+)/i);
        if (idMatch && text.trim().length > 0) {
          const orderId = idMatch[1];
          const { data: order } = await supabaseAdmin.from('bookings').select('telegram_id').eq('id', orderId).single();
          if (order?.telegram_id) {
            await tgPost(token, 'sendMessage', {
              chat_id: Number(order.telegram_id),
              text: `💬 *Сообщение от менеджера / Message from manager:*\n\n${text}`,
              parse_mode: 'Markdown',
            });
            await tgPost(token, 'sendMessage', { chat_id: MY_ADMIN_ID, text: `✅ Доставлено клиенту (заказ №${orderId})` });
            return NextResponse.json({ ok: true });
          }
        }
      }

      // ── /broadcast с фото ─────────────────────────────────────────────────
      if (chatId === MY_ADMIN_ID && body.message.photo) {
        const caption = body.message.caption || '';
        if (caption.startsWith('/broadcast')) {
          const broadcastCaption = caption.replace('/broadcast', '').trim();
          const photoFileId = body.message.photo[body.message.photo.length - 1].file_id;
          const { data: users } = await supabaseAdmin.from('users').select('telegram_id');
          if (!users?.length) {
            await tgPost(token, 'sendMessage', { chat_id: MY_ADMIN_ID, text: "⚠️ Пользователей в базе пока нет." });
            return NextResponse.json({ ok: true });
          }
          let sent = 0, failed = 0;
          for (const user of users) {
            try {
              const res = await tgPost(token, 'sendPhoto', { chat_id: Number(user.telegram_id), photo: photoFileId, caption: broadcastCaption, parse_mode: 'Markdown' });
              const d = await res.json();
              d.ok ? sent++ : failed++;
            } catch { failed++; }
            await new Promise(r => setTimeout(r, 50));
          }
          await tgPost(token, 'sendMessage', {
            chat_id: MY_ADMIN_ID,
            text: `📊 *Рассылка с фото завершена*\n\n✅ Доставлено: ${sent}\n❌ Ошибок: ${failed}\n👥 Всего: ${users.length}`,
            parse_mode: 'Markdown',
          });
          return NextResponse.json({ ok: true });
        }
      }

      // ── /admin ────────────────────────────────────────────────────────────
      if (text === '/admin' && chatId === MY_ADMIN_ID) {
        const { data: orders } = await supabaseAdmin
          .from('bookings').select('*').order('created_at', { ascending: false }).limit(5);

        if (!orders?.length) {
          await tgPost(token, 'sendMessage', { chat_id: MY_ADMIN_ID, text: "Заявок пока нет." });
          return NextResponse.json({ ok: true });
        }
        for (const o of orders) {
          const icon = o.status === 'confirmed' ? '✅' : o.status === 'cancelled' ? '❌' : o.status === 'unavailable' ? '🚫' : '⏳';
          await tgPost(token, 'sendMessage', {
            chat_id: MY_ADMIN_ID,
            text:
              `${icon} *Заказ №${o.id}*\n` +
              `🐉 Тур: ${o.bike_model}\n` +
              `📅 Дата: ${o.start_date}\n` +
              `💰 Сумма: ${o.total_price || '—'}\n` +
              `👤 Клиент: @${o.client_username}\n` +
              `🔗 Реферал: ${o.referrer || 'Прямой заход'}`,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: "⚙️ Управлять", callback_data: `manage_${o.id}` }]] },
          });
        }
        return NextResponse.json({ ok: true });
      }

      // ── /broadcast текст ──────────────────────────────────────────────────
      if (text.startsWith('/broadcast') && chatId === MY_ADMIN_ID) {
        const broadcastText = text.replace('/broadcast', '').trim();
        if (!broadcastText) {
          await tgPost(token, 'sendMessage', {
            chat_id: MY_ADMIN_ID,
            text: "⚠️ Укажите текст.\n\nПример:\n`/broadcast Новый тур — Мраморные горы!`",
            parse_mode: 'Markdown',
          });
          return NextResponse.json({ ok: true });
        }
        const { data: users } = await supabaseAdmin.from('users').select('telegram_id');
        if (!users?.length) {
          await tgPost(token, 'sendMessage', { chat_id: MY_ADMIN_ID, text: "⚠️ Пользователей в базе пока нет." });
          return NextResponse.json({ ok: true });
        }
        let sent = 0, failed = 0;
        for (const user of users) {
          try {
            const res = await tgPost(token, 'sendMessage', { chat_id: Number(user.telegram_id), text: broadcastText, parse_mode: 'Markdown' });
            const d = await res.json();
            d.ok ? sent++ : failed++;
          } catch { failed++; }
          await new Promise(r => setTimeout(r, 50));
        }
        await tgPost(token, 'sendMessage', {
          chat_id: MY_ADMIN_ID,
          text: `📊 *Рассылка завершена*\n\n✅ Доставлено: ${sent}\n❌ Ошибок: ${failed}\n👥 Всего: ${users.length}`,
          parse_mode: 'Markdown',
        });
        return NextResponse.json({ ok: true });
      }

      // ── /start ────────────────────────────────────────────────────────────
      if (text.startsWith('/start')) {
        const parts      = text.split(' ');
        const startParam = parts.length > 1 ? parts[1] : 'direct';

        // Сохраняем пользователя + реферала
        await supabaseAdmin.from('users').upsert(
          { telegram_id: chatId, referrer: startParam, username },
          { onConflict: 'telegram_id' }
        );

        const isSubscribed = await checkSubscription(token, userId);

        if (!isSubscribed) {
          await tgPost(token, 'sendMessage', {
            chat_id: chatId, text: MSG_START_NOT_SUBSCRIBED, parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [
              [{ text: "📢 Подписаться / Subscribe", url: `https://t.me/${CHANNEL.replace('@','')}` }],
              [{ text: "🔄 Проверить подписку / Check", callback_data: "check_sub" }],
            ]},
          });
          return NextResponse.json({ ok: true });
        }

        await tgPost(token, 'sendMessage', {
          chat_id: chatId, text: MSG_START_SUBSCRIBED, parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "🐉 Открыть каталог / Open Catalog", web_app: { url: CATALOG_URL } }]] },
        });
        return NextResponse.json({ ok: true });
      }

      // ── FALLBACK ──────────────────────────────────────────────────────────
      if (chatId !== MY_ADMIN_ID) {
        const isSubscribed = await checkSubscription(token, userId);
        await tgPost(token, 'sendMessage', { chat_id: chatId, text: MSG_FALLBACK, parse_mode: 'Markdown' });

        if (!isSubscribed) {
          await tgPost(token, 'sendMessage', {
            chat_id: chatId, text: MSG_START_NOT_SUBSCRIBED, parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [
              [{ text: "📢 Подписаться / Subscribe", url: `https://t.me/${CHANNEL.replace('@','')}` }],
              [{ text: "🔄 Проверить подписку / Check", callback_data: "check_sub" }],
            ]},
          });
        } else {
          await tgPost(token, 'sendMessage', {
            chat_id: chatId, text: MSG_START_SUBSCRIBED, parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "🐉 Открыть каталог / Open Catalog", web_app: { url: CATALOG_URL } }]] },
          });
        }
        return NextResponse.json({ ok: true });
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({ status: "alive" });
}