# Реєстрація та налаштування GitHub Actions Runner (ЛР3)

Цей документ описує ручні кроки, необхідні для підключення ВМ `runner` як self-hosted ранера до вашого репозиторію та налаштування безпарольного доступу по SSH до ВМ `target`.

---

## Крок 1. Налаштування безпарольного SSH доступу

Щоб GitHub Actions Runner на машині `runner` міг розгорнути додаток на машині `target` (`192.168.56.10`), він має підключатися по SSH без пароля під користувачем `mywebapp`.

Виконайте наступну команду на вашій хост-машині (Windows) у папці проекту:

```bash
vagrant ssh runner -c "cat ~/.ssh/id_ed25519.pub" | vagrant ssh target -c "sudo -u mywebapp tee -a /home/mywebapp/.ssh/authorized_keys"
```

### Перевірка підключення:
Зайдіть по SSH на runner та спробуйте підключитися до target:
```bash
vagrant ssh runner
ssh mywebapp@192.168.56.10 "echo 'SSH з Runner на Target працює!'"
```
Якщо ви побачили повідомлення без запиту пароля — налаштування виконано успішно.

---

## Крок 2. Реєстрація Runner у GitHub

1. Відкрийте ваш репозиторій на GitHub.
2. Перейдіть до **Settings** (Налаштування) -> **Actions** -> **Runners**.
3. Натисніть кнопку **New self-hosted runner** (Додати новий self-hosted ранер).
4. Оберіть Runner Image: **Linux**, Architecture: **X64**.
5. Скопіюйте посилання на репозиторій та реєстраційний токен (вони знаходяться у полі команди `./config.sh`).

Зайдіть на віртуальну машину `runner`:
```bash
vagrant ssh runner
```
Перейдіть до робочої папки ранера та запустіть конфігурацію:
```bash
cd ~/actions-runner
./config.sh --url https://github.com/Alexisonfire95/DevOps-KPI_Lab3 --token <ВСТАВТЕ_ВАШ_ТОКЕН>
```
*Під час конфігурації:*
* **Runner group:** Натисніть Enter (за замовчуванням `Default`).
* **Runner name:** Можна залишити за замовчуванням (наприклад, `github-runner`) або ввести своє.
* **Runner tags:** Введіть `self-hosted` (це важливо для запуску CD джоби).
* **Work folder:** Натисніть Enter (за замовчуванням `_work`).

---

## Крок 3. Запуск Runner як системної служби

Щоб ранер працював у фоновому режимі та запускався автоматично при старті ВМ, налаштуйте його як системну службу:

```bash
sudo ./svc.sh install runner
sudo ./svc.sh start
```

### Перевірка статусу:
Перевірте, що служба активна:
```bash
sudo ./svc.sh status
```
Також на GitHub у вкладці **Settings** -> **Actions** -> **Runners** ваш ранер має змінити статус на **Idle** (зелений кружечок).

---

## Як видалити runner після демонстрації

Якщо потрібно прибрати ранер з репозиторію:
1. Зайдіть на `runner`: `vagrant ssh runner`
2. Перейдіть у `cd ~/actions-runner`
3. Зупиніть та видаліть службу:
   ```bash
   sudo ./svc.sh stop
   sudo ./svc.sh uninstall
   ```
4. Видаліть ранер з GitHub (знадобиться remove-токен з налаштувань GitHub):
   ```bash
   ./config.sh remove --token <REMOVE_TOKEN>
   ```
