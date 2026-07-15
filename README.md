# Что по плану — личный планировщик задач

React + Vite PWA для личного трекинга задач по контекстам (Газпром / Фриланс / Личное) и проектам. Все данные задач хранятся локально в IndexedDB, синхронизации между устройствами нет. Единственное, что уходит в облако — напоминания (push-уведомления), см. ниже.

## Разработка

```bash
npm install
npm run dev
```

Для локальной работы с напоминаниями нужен `.env` (см. `.env.example`) с `VITE_VAPID_PUBLIC_KEY` и `VITE_REMINDERS_API_URL`. Без них приложение работает как обычно, просто кнопка напоминания будет молча деградировать (см. ниже).

## Деплой

Деплой полностью автоматический через GitHub Actions (`.github/workflows/deploy.yml`) при пуше в `main` — ни фронтенд, ни облачные функции не разворачиваются вручную с локальной машины. Workflow можно также запустить вручную (`Actions → Deploy → Run workflow`).

Workflow состоит из двух джобов:
1. **deploy-functions** — разворачивает обе Yandex Cloud Function (`manage-reminders`, `send-reminders`), выдаёт `manage-reminders` право на анонимный вызов, создаёт (если ещё нет) таймер-триггер `send-reminders-timer` (раз в минуту).
2. **deploy-pages** — собирает фронтенд (`vite build`), подставляя URL функции `manage-reminders`, полученный из первого джоба, и публикует `dist/` в ветку `gh-pages` через `peaceiris/actions-gh-pages`.

## Резервное копирование задач

Кнопки **Экспорт** / **Импорт** в шапке приложения сохраняют/восстанавливают все данные (contexts, projects, tasks) в виде JSON-файла. Это единственная защита от потери данных при очистке кэша браузера — рекомендуется делать экспорт регулярно.

## Хранилище задач

IndexedDB, база `task-planner`, object stores: `contexts`, `projects`, `tasks`. Схема и сидинг по умолчанию — в [src/db.js](src/db.js).

## Напоминания (push-уведомления)

Отдельная, независимая от IndexedDB цепочка на Yandex Cloud (без Firebase — Google Cloud billing не принимает российские карты):

```
браузер ──subscribe/upsert/delete──▶ manage-reminders (HTTP Function)
                                              │
                                              ▼
                                   reminders.json в Object Storage
                                              ▲
                                              │ читает раз в минуту
                                   send-reminders (Timer Function, cron)
                                              │
                                              ▼
                                     web-push → PushSubscription браузера
```

- **Источник правды для UI** — по-прежнему IndexedDB (`task.reminderAt`). Облако хранит только то, что нужно для доставки: одну PushSubscription и список ещё не сработавших напоминаний (`id`, `text`, `remindAt`).
- Хранилище — один JSON-файл `reminders.json` в Object Storage (бакет `task-planner-ilmak379`), не полноценная БД — этого достаточно для одного пользователя.
- `manage-reminders` (`functions/manage-reminders`) — HTTP-функция, принимает `{ action: "subscribe" | "upsertReminder" | "deleteReminder", ... }`, читает/модифицирует/перезаписывает `reminders.json`. Доступна анонимно (CORS ограничен доменом `https://ilyamc3-hash.github.io`), но писать в бакет умеет только сама функция — креды у неё в переменных окружения, в браузере их нет.
- `send-reminders` (`functions/send-reminders`) — таймер-функция (cron `* * * * ? *`, раз в минуту), находит просроченные напоминания и шлёт push через `web-push`. Доставленные (или для которых подписка протухла) — сразу удаляются из файла, чтобы он не разрастался.
- Если пользователь не разрешил уведомления в браузере — `reminderAt` всё равно сохраняется локально в IndexedDB, но в UI показывается предупреждение, а запрос в `manage-reminders` не отправляется (или падает и просто показывает тост) — это не ломает остальной функционал.

### VAPID-ключи

Публичный ключ — не секрет, встраивается в бандл через `VITE_VAPID_PUBLIC_KEY`. Приватный — только в окружении функции `send-reminders`, никогда не в клиенте и не в репозитории.

Сгенерировать новую пару (если нужно перевыпустить): `npx web-push generate-vapid-keys`.

### Нужные GitHub Secrets (Settings → Secrets and variables → Actions)

Уже должны быть добавлены (Yandex Cloud):
| Secret | Назначение |
|---|---|
| `YC_SA_KEY` | Авторизованный ключ сервисного аккаунта (JSON) — им `yc` в CI логинится и разворачивает функции |
| `YC_ACCESS_KEY_ID` / `YC_SECRET_ACCESS_KEY` | Статические ключи для S3 API Object Storage — их получают функции в переменных окружения |
| `YC_CLOUD_ID`, `YC_FOLDER_ID` | Идентификаторы облака/каталога |
| `YC_BUCKET_NAME` | Имя бакета (`task-planner-ilmak379`) |

Нужно добавить дополнительно (сгенерированы в рамках этой задачи, см. сообщение в чате, где они были выданы):
| Secret | Назначение |
|---|---|
| `VAPID_PUBLIC_KEY` | Публичный VAPID-ключ — идёт и в сборку фронтенда, и в окружение `send-reminders` |
| `VAPID_PRIVATE_KEY` | Приватный VAPID-ключ — **только** в окружение `send-reminders` |

`VITE_REMINDERS_API_URL` секретом быть не должен и не является: workflow сам получает актуальный invoke URL функции `manage-reminders` через `yc serverless function get` на каждом деплое и передаёт его в сборку фронтенда — это исключает рассинхрон, если функцию когда-то пересоздадут.

### Если деплой упал с ошибкой прав доступа

Вся авторизация в workflow идёт от одного сервис-аккаунта — того, чей ключ лежит в `YC_SA_KEY`. Практически все ошибки `PermissionDenied` сводятся к одному: этому аккаунту не хватает роли. Что проверить по порядку:

1. **`yc config set service-account-key` / любая `yc serverless function ...` падает** — ключ в `YC_SA_KEY` невалиден, отозван или просрочен. Перевыпустить: `yc iam key create --service-account-id <id> --output key.json` и обновить secret.
2. **Создание/обновление функций (`function create`, `function version create`) падает с `PermissionDenied`** — сервис-аккаунту нужна роль `serverless.functions.admin` (или как минимум `serverless.functions.editor`) на каталоге `YC_FOLDER_ID`.
3. **`function allow-unauthenticated-invoke` падает** — тому же аккаунту нужна возможность управлять IAM-биндингами функции, обычно покрывается `serverless.functions.admin` из п.2, либо отдельно `serverless.functions.admin` на конкретной функции.
4. **`resource-manager folder add-access-binding` падает** — это самый частый источник ошибок: чтобы аккаунт мог выдавать роль `serverless.functions.invoker` другому (себе же, для триггера), ему нужна роль `resource-manager.admin` (или `admin`) на каталоге, а не только `editor`.
5. **Сама функция `manage-reminders` или `send-reminders` в рантайме падает с `AccessDenied` при обращении к Object Storage** — это уже не про `YC_SA_KEY`, а про статические ключи `YC_ACCESS_KEY_ID`/`YC_SECRET_ACCESS_KEY`: у связанного с ними сервис-аккаунта должна быть роль `storage.editor` (или `storage.admin`) на бакете `YC_BUCKET_NAME`.
6. **Таймер не срабатывает / `send-reminders` не вызывается** — проверить, что у сервис-аккаунта, переданного в `--invoke-function-service-account-id` (это тот же аккаунт из `YC_SA_KEY`), есть роль `serverless.functions.invoker` — шаг workflow "Grant the deploy service account invoker rights" должен был её выдать; если он упал раньше (см. п.4), триггер создастся с аккаунтом без прав и будет молча не срабатывать.

Смотреть логи выполнения функций: `yc serverless function logs --name send-reminders` / `--name manage-reminders` (или в консоли Yandex Cloud → Cloud Functions → соответствующая функция → Логи).
