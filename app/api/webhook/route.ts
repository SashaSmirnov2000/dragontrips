import { NextResponse } from 'next/server';
import { supabase } from '@/app/supabase';
import { createClient } from '@supabase/supabase-js';

const MY_ADMIN_ID = 1920798985;
const SUPPORT_LINK = "https://t.me/dragonservicesupport";

async function tgPost(botToken: string, method: string, body: object) {
  return fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function checkSubscription(botToken: string, userId: number) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: "@dragonindanang", user_id: userId })
    });
    const data = await response.json();
    if (!data.ok) return false;
    const status = data.result?.status;
    if (status === 'left' || status === 'kicked') return false;
    return ['member', 'administrator', 'creator'].includes(status);
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ТЕКСТЫ СООБЩЕНИЙ
// ─────────────────────────────────────────────────────────────────────────────

const MSG_NOT_SUBSCRIBED =
  "🛵 *Один шаг до поездки!*\n\n" +
  "Подпишитесь на наш канал — это быстро и бесплатно.\n" +
  "После подписки вы сразу получите доступ к каталогу байков.\n\n" +
  "━━━━━━━━━━━━━━━━━\n\n" +
  "🛵 *One step to your ride!*\n\n" +
  "Subscribe to our channel — it's quick and free.\n" +
  "After subscribing, you'll get instant access to the bike catalog.";

const MSG_WELCOME_CATALOG =
  "✅ *Подписка подтверждена — добро пожаловать!*\n\n" +
  "Открывайте каталог и бронируйте байк прямо сейчас.\n\n" +
  "🆘 Поддержка: @dragonservicesupport\n\n" +
  "━━━━━━━━━━━━━━━━━\n\n" +
  "✅ *Subscription confirmed — welcome aboard!*\n\n" +
  "Open the catalog and book your bike right now.\n\n" +
  "🆘 Support: @dragonservicesupport";

const MSG_START_NOT_SUBSCRIBED =
  "🌴 *Привет! Это Dragon Services — аренда байков в Дананге.*\n\n" +
  "Забудьте о переписках, ожиданиях и лишних хлопотах.\n" +
  "Здесь всё просто:\n\n" +
  "• Выбираете байк из каталога\n" +
  "• Бронируете в один клик\n" +
  "• Наслаждаетесь поездкой\n\n" +
  "Никаких звонков. Никакого ожидания. Всё автоматически.\n\n" +
  "Чтобы открыть каталог, подпишитесь на наш канал 👇\n\n" +
  "━━━━━━━━━━━━━━━━━\n\n" +
  "🌴 *Hey! This is Dragon Services — bike rentals in Da Nang.*\n\n" +
  "Forget about chats, waiting, and extra hassle.\n" +
  "It's all super simple here:\n\n" +
  "• Pick a bike from the catalog\n" +
  "• Book in one click\n" +
  "• Enjoy the ride\n\n" +
  "No calls. No waiting. Fully automated.\n\n" +
  "To open the catalog, subscribe to our channel 👇";

const MSG_START_SUBSCRIBED =
  "🌴 *Привет! Это Dragon Services — аренда байков в Дананге.*\n\n" +
  "Забудьте о переписках, ожиданиях и лишних хлопотах.\n" +
  "Здесь всё просто:\n\n" +
  "• Выбираете байк из каталога\n" +
  "• Бронируете в один клик\n" +
  "• Наслаждаетесь поездкой\n\n" +
  "Никаких звонков. Никакого ожидания. Всё автоматически.\n\n" +
  "🆘 Поддержка: @dragonservicesupport\n\n" +
  "━━━━━━━━━━━━━━━━━\n\n" +
  "🌴 *Hey! This is Dragon Services — bike rentals in Da Nang.*\n\n" +
  "Forget about chats, waiting, and extra hassle.\n" +
  "It's all super simple here:\n\n" +
  "• Pick a bike from the catalog\n" +
  "• Book in one click\n" +
  "• Enjoy the ride\n\n" +
  "No calls. No waiting. Fully automated.\n\n" +
  "🆘 Support: @dragonservicesupport";

const MSG_BOOKING_CANCELLED =
  "❌ *Бронирование отменено.*\n\n" +
  "Хотите выбрать другой байк? Каталог всегда открыт!\n\n" +
  "━━━━━━━━━━━━━━━━━\n\n" +
  "❌ *Booking cancelled.*\n\n" +
  "Want to pick a different bike? The catalog is always open!";

const MSG_BOOKING_CONFIRMED =
  "✅ *Байк подтверждён и свободен для вас!*\n\n" +
  "Напишите менеджеру любое сообщение — он пришлёт вам все детали о доставке.\n\n" +
  "━━━━━━━━━━━━━━━━━\n\n" +
  "✅ *Your bike is confirmed and ready!*\n\n" +
  "Send the manager any message — they'll send you all the delivery details.";

const MSG_BOOKING_UNAVAILABLE =
  "😔 *К сожалению, этот байк уже занят.*\n\n" +
  "Напишите менеджеру любое сообщение — мы пришлём вам похожие свободные варианты.\n\n" +
  "━━━━━━━━━━━━━━━━━\n\n" +
  "😔 *Sorry, this bike is no longer available.*\n\n" +
  "Send the manager any message — we'll send you similar available options.";

const MSG_FALLBACK =
  "👋 *Кажется, я не совсем понял ваш запрос.*\n\n" +
  "Чтобы было быстрее и удобнее — пользуйтесь кнопками меню.\n" +
  "Сейчас отправлю стартовое меню 👇\n\n" +
  "━━━━━━━━━━━━━━━━━\n\n" +
  "👋 *Hmm, I didn't quite get that.*\n\n" +
  "For the fastest experience — please use the menu buttons.\n" +
  "Sending you the main menu now 👇";

// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = process.env.TELEGRAM_BOT_TOKEN!;

    // Используем service role для админских операций
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (!token) return NextResponse.json({ error: "No Token" }, { status: 500 });

    // ═══════════════════════════════════════════════════════════════
    // БЛОК 1: CALLBACK QUERIES (нажатия на кнопки)
    // ═══════════════════════════════════════════════════════════════
    if (body.callback_query) {
      const callbackId = body.callback_query.id;
      const callbackData = body.callback_query.data as string;
      const chatId = body.callback_query.message.chat.id;
      const messageId = body.callback_query.message.message_id;
      const oldText = body.callback_query.message.text || "";

      const answerCallback = () =>
        tgPost(token, 'answerCallbackQuery', { callback_query_id: callbackId });

      // ── check_sub: проверка подписки на канал ──────────────────────────────
      if (callbackData === 'check_sub') {
        const userId = body.callback_query.from.id;
        const isSubscribed = await checkSubscription(token, userId);

        if (!isSubscribed) {
          await answerCallback();
          await tgPost(token, 'sendMessage', {
            chat_id: chatId,
            text: MSG_NOT_SUBSCRIBED,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "📢 Подписаться / Subscribe", url: "https://t.me/dragonindanang" }],
                [{ text: "🔄 Проверить подписку / Check subscription", callback_data: "check_sub" }]
              ]
            }
          });
          return NextResponse.json({ ok: true });
        }

        // Подписан — показываем каталог
        await answerCallback();
        await tgPost(token, 'sendMessage', {
          chat_id: chatId,
          text: MSG_WELCOME_CATALOG,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[{ text: "🛵 Открыть каталог / Open Catalog", web_app: { url: "https://scooter-danang.vercel.app" } }]]
          }
        });
        return NextResponse.json({ ok: true });
      }

      // ── cancel_order_{bikeId}: клиент отменяет заказ ──────────────────────
      if (callbackData.startsWith('cancel_order_')) {
        const bikeId = callbackData.replace('cancel_order_', '');

        const { data: booking } = await supabaseAdmin
          .from('bookings')
          .select('id, bike_model')
          .eq('telegram_id', chatId)
          .eq('bike_id', bikeId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (booking) {
          await supabaseAdmin.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id);

          // Уведомляем админа
          await tgPost(token, 'sendMessage', {
            chat_id: MY_ADMIN_ID,
            text: `❌ *Заказ №${booking.id} отменён клиентом.*\nБайк: ${booking.bike_model}`,
            parse_mode: 'Markdown',
          });
        }

        await tgPost(token, 'editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: MSG_BOOKING_CANCELLED,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: "🛵 Открыть каталог / Open Catalog", web_app: { url: "https://scooter-danang.vercel.app" } }]],
          },
        });

        await answerCallback();
        return NextResponse.json({ ok: true });
      }

      // ── Все остальные кнопки — только для админа ──────────────────────────
      if (chatId !== MY_ADMIN_ID) {
        await answerCallback();
        return NextResponse.json({ ok: true });
      }

      // ── manage_{id}: показать кнопки управления заказом ───────────────────
      if (callbackData.startsWith('manage_')) {
        const orderId = callbackData.replace('manage_', '');
        await tgPost(token, 'editMessageReplyMarkup', {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Подтвердить наличие", callback_data: `confirm_${orderId}` }],
              [{ text: "❌ Нет в наличии",       callback_data: `decline_${orderId}` }],
              [{ text: "✉️ Написать клиенту",    callback_data: `ask_msg_${orderId}` }],
            ],
          },
        });
        await answerCallback();
        return NextResponse.json({ ok: true });
      }

      // ── confirm_{id}: подтвердить заказ ───────────────────────────────────
      if (callbackData.startsWith('confirm_')) {
        const id = callbackData.replace('confirm_', '');
        const { data: order } = await supabaseAdmin.from('bookings').select('*').eq('id', id).single();

        if (order && order.status !== 'confirmed') {
          await supabaseAdmin.from('bookings').update({ status: 'confirmed' }).eq('id', id);

          await tgPost(token, 'sendMessage', {
            chat_id: Number(order.telegram_id),
            text: MSG_BOOKING_CONFIRMED,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: "✉️ Написать менеджеру / Message manager", url: SUPPORT_LINK }]] },
          });

          await tgPost(token, 'editMessageText', {
            chat_id: MY_ADMIN_ID,
            message_id: messageId,
            text: oldText + "\n\n✅ *СТАТУС: ПОДТВЕРЖДЕНО*",
            parse_mode: 'Markdown',
          });
        }

        await answerCallback();
        return NextResponse.json({ ok: true });
      }

      // ── decline_{id}: отказать в заказе ───────────────────────────────────
      if (callbackData.startsWith('decline_')) {
        const id = callbackData.replace('decline_', '');
        const { data: order } = await supabaseAdmin.from('bookings').select('*').eq('id', id).single();

        if (order && order.status !== 'unavailable') {
          await supabaseAdmin.from('bookings').update({ status: 'unavailable' }).eq('id', id);

          await tgPost(token, 'sendMessage', {
            chat_id: Number(order.telegram_id),
            text: MSG_BOOKING_UNAVAILABLE,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: "🤝 Написать менеджеру / Message manager", url: SUPPORT_LINK }]] },
          });

          await tgPost(token, 'editMessageText', {
            chat_id: MY_ADMIN_ID,
            message_id: messageId,
            text: oldText + "\n\n❌ *СТАТУС: НЕТ В НАЛИЧИИ*",
            parse_mode: 'Markdown',
          });
        }

        await answerCallback();
        return NextResponse.json({ ok: true });
      }

      // ── ask_msg_{id}: запросить сообщение для клиента ─────────────────────
      if (callbackData.startsWith('ask_msg_')) {
        const id = callbackData.replace('ask_msg_', '');
        await tgPost(token, 'sendMessage', {
          chat_id: MY_ADMIN_ID,
          text: `📝 Напишите сообщение для заказа №${id}:\n(Обязательно используйте ОТВЕТ/REPLY на это сообщение)`,
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
      const chatId = body.message.chat.id;
      const text = body.message.text || '';
      const userId = body.message.from?.id;
      const username = body.message.from?.username || "anonymous";

      // ── Ответ админа через reply (переадресация клиенту) ──────────────────
      if (chatId === MY_ADMIN_ID && body.message.reply_to_message) {
        const replyText = body.message.reply_to_message.text || "";
        const idMatch = replyText.match(/(?:№|заказа\s+)(\d+)/i);

        if (idMatch && text.trim().length > 0) {
          const orderId = idMatch[1];
          const { data: order } = await supabaseAdmin
            .from('bookings')
            .select('telegram_id')
            .eq('id', orderId)
            .single();

          if (order?.telegram_id) {
            await tgPost(token, 'sendMessage', {
              chat_id: Number(order.telegram_id),
              text: `💬 *Сообщение от менеджера / Message from manager:*\n\n${text}`,
              parse_mode: 'Markdown',
            });
            await tgPost(token, 'sendMessage', {
              chat_id: MY_ADMIN_ID,
              text: `✅ Доставлено клиенту (заказ №${orderId})`,
            });
            return NextResponse.json({ ok: true });
          }
        }
      }

      // ── /broadcast с фото (только для админа) ────────────────────────────
      if (chatId === MY_ADMIN_ID && body.message.photo) {
        const caption = body.message.caption || '';
        if (caption.startsWith('/broadcast')) {
          const broadcastCaption = caption.replace('/broadcast', '').trim();
          const photoFileId = body.message.photo[body.message.photo.length - 1].file_id;

          const { data: users } = await supabaseAdmin
            .from('users')
            .select('telegram_id');

          if (!users || users.length === 0) {
            await tgPost(token, 'sendMessage', {
              chat_id: MY_ADMIN_ID,
              text: "⚠️ Пользователей в базе пока нет.",
            });
            return NextResponse.json({ ok: true });
          }

          let sent = 0;
          let failed = 0;

          for (const user of users) {
            try {
              const res = await tgPost(token, 'sendPhoto', {
                chat_id: Number(user.telegram_id),
                photo: photoFileId,
                caption: broadcastCaption,
                parse_mode: 'Markdown',
              });
              const data = await res.json();
              if (data.ok) sent++;
              else failed++;
            } catch {
              failed++;
            }
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

      // ── /admin (только для админа) ────────────────────────────────────────
      if (text === '/admin' && chatId === MY_ADMIN_ID) {
        const { data: orders } = await supabaseAdmin
          .from('bookings')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);

        if (!orders || orders.length === 0) {
          await tgPost(token, 'sendMessage', { chat_id: MY_ADMIN_ID, text: "Заявок пока нет." });
          return NextResponse.json({ ok: true });
        }

        for (const o of orders) {
          const icon =
            o.status === 'confirmed'   ? '✅' :
            o.status === 'cancelled'   ? '❌' :
            o.status === 'unavailable' ? '🚫' : '⏳';

          await tgPost(token, 'sendMessage', {
            chat_id: MY_ADMIN_ID,
            text: `${icon} *Заказ №${o.id}*\nБайк: ${o.bike_model}\nДаты: ${o.start_date} – ${o.end_date}\nСумма: ${o.total_price || '—'}\nКлиент: @${o.client_username}\nРеферал: ${o.referrer || 'Прямой заход'}`,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: "⚙️ Управлять", callback_data: `manage_${o.id}` }]] },
          });
        }

        return NextResponse.json({ ok: true });
      }

      // ── /broadcast (только для админа) ────────────────────────────────────
      if (text.startsWith('/broadcast') && chatId === MY_ADMIN_ID) {
        const broadcastText = text.replace('/broadcast', '').trim();

        if (!broadcastText) {
          await tgPost(token, 'sendMessage', {
            chat_id: MY_ADMIN_ID,
            text: "⚠️ Укажите текст рассылки.\n\nПример:\n`/broadcast Привет! У нас новый сервис...`",
            parse_mode: 'Markdown',
          });
          return NextResponse.json({ ok: true });
        }

        const { data: users } = await supabaseAdmin
          .from('users')
          .select('telegram_id');

        if (!users || users.length === 0) {
          await tgPost(token, 'sendMessage', {
            chat_id: MY_ADMIN_ID,
            text: "⚠️ Пользователей в базе пока нет.",
          });
          return NextResponse.json({ ok: true });
        }

        let sent = 0;
        let failed = 0;

        for (const user of users) {
          try {
            const res = await tgPost(token, 'sendMessage', {
              chat_id: Number(user.telegram_id),
              text: broadcastText,
              parse_mode: 'Markdown',
            });
            const data = await res.json();
            if (data.ok) sent++;
            else failed++;
          } catch {
            failed++;
          }
          // Пауза чтобы не словить rate limit Telegram
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
        const parts = text.split(' ');
        const startParam = parts.length > 1 ? parts[1] : 'direct';

        // Записываем реферала
        await supabase.from('users').upsert(
          { telegram_id: chatId, referrer: startParam, username },
          { onConflict: 'telegram_id' }
        );

        // Проверяем подписку
        const isSubscribed = await checkSubscription(token, userId);

        if (!isSubscribed) {
          await tgPost(token, 'sendMessage', {
            chat_id: chatId,
            text: MSG_START_NOT_SUBSCRIBED,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "📢 Подписаться / Subscribe", url: "https://t.me/dragonindanang" }],
                [{ text: "🔄 Проверить подписку / Check subscription", callback_data: "check_sub" }]
              ]
            }
          });
          return NextResponse.json({ ok: true });
        }

        // Подписан — показываем каталог
        await tgPost(token, 'sendMessage', {
          chat_id: chatId,
          text: MSG_START_SUBSCRIBED,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[{ text: "🛵 Открыть каталог / Open Catalog", web_app: { url: "https://scooter-danang.vercel.app" } }]]
          }
        });

        return NextResponse.json({ ok: true });
      }

      // ── FALLBACK: любое нераспознанное сообщение ──────────────────────────
      // (не от админа, не команда)
      if (chatId !== MY_ADMIN_ID) {
        const isSubscribed = await checkSubscription(token, userId);

        // Отправляем вежливое объяснение
        await tgPost(token, 'sendMessage', {
          chat_id: chatId,
          text: MSG_FALLBACK,
          parse_mode: 'Markdown',
        });

        // Отправляем стартовое меню заново
        if (!isSubscribed) {
          await tgPost(token, 'sendMessage', {
            chat_id: chatId,
            text: MSG_START_NOT_SUBSCRIBED,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "📢 Подписаться / Subscribe", url: "https://t.me/dragonindanang" }],
                [{ text: "🔄 Проверить подписку / Check subscription", callback_data: "check_sub" }]
              ]
            }
          });
        } else {
          await tgPost(token, 'sendMessage', {
            chat_id: chatId,
            text: MSG_START_SUBSCRIBED,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [[{ text: "🛵 Открыть каталог / Open Catalog", web_app: { url: "https://scooter-danang.vercel.app" } }]]
            }
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