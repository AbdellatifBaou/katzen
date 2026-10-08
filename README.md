# 🐾 Katzen-Feeder (Mimi, Miscu & Luna)

Eine schicke, mobile-optimierte Web-App für 5 Personen zur gemeinsamen Organisation der Fütterungen für unsere Katzenfamilie:
* **Mimi** (5 Jahre)
* **Miscu** (2 Monate - Baby Kitten)
* **Luna** (2 Monate - Baby Kitten)

---

## ✨ Features

1. **Gemeinsame Fütterung:** 1-Klick Erfassung für alle 3 Katzen gleichzeitig.
2. **Kategorien:**
   * 🥣 **Nassfutter:** Morgens, Mittags, Abends mit Zähler & Soll-Ziel.
   * 🍪 **Trockenfutter:** Napf-Auffüllung.
   * 🐟 **Leckerli-Zähler:** Mit Tageslimit (verhindert Überfütterung durch 5 Personen!).
3. **5-Personen Profilauswahl:** Einfach den eigenen Namen auswählen und mit 1 Klick eintragen.
4. **Live-Synchronisierung (Echtzeit):** Sobald jemand füttert, aktualisiert sich die Anzeige bei allen 5 Personen auf dem Smartphone.
5. **PWA-fähig:** Kann direkt auf iOS/Android als App zum Home-Bildschirm hinzugefügt werden.

---

## 🚀 Schnellanleitung: Auf Vercel deployen

### 1. Kostenlose Supabase Datenbank (2 Minuten)
1. Geh auf [supabase.com](https://supabase.com) und erstelle ein kostenloses Projekt.
2. Öffne den **SQL Editor** und führe folgendes Skript aus:

```sql
create table if not exists feedings (
  id text primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_name text not null,
  user_id text not null,
  type text not null,
  meal_time text,
  notes text,
  food_brand text,
  portion_size text
);

alter table feedings enable row level security;

create policy "Allow all access to feedings"
on feedings for all
using (true)
with check (true);

alter publication supabase_realtime add table feedings;
```

3. Kopiere unter **Project Settings -> API** die `Project URL` und den `anon public API Key`.

---

### 2. Auf Vercel veröffentlichen (1 Klick)
1. Repository auf GitHub pushen.
2. Auf [vercel.com](https://vercel.com) importieren.
3. Unter **Environment Variables** folgende 2 Variablen hinzufügen:
   * `NEXT_PUBLIC_SUPABASE_URL`
   * `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Auf **Deploy** klicken – fertig!

---

## 💻 Lokale Entwicklung

```bash
npm install
npm run dev
```

App im Browser öffnen: [http://localhost:3000](http://localhost:3000)
