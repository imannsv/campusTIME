import { test, expect, type Page } from "@playwright/test";

async function openFreddy(page: Page) {
  await page.clock.install({ time: new Date("2026-10-07T08:00:00+02:00") });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Freddy öffnen", exact: true })
    .click();
  return page.getByRole("dialog", { name: "Freddy", exact: true });
}
async function ask(page: Page, question: string) {
  const answers = page.locator(".campus-ai-message.assistant");
  const count = await answers.count();
  await page.getByLabel("Deine Frage an Freddy").fill(question);
  await page.getByRole("button", { name: "Frage senden", exact: true }).click();
  await expect(answers).toHaveCount(count + 1);
  return answers.last();
}

test("Freddy fragt bei einer Raumfrage nach dem fehlenden Ende statt falsche Anleitungen zu geben", async ({
  page,
}) => {
  await openFreddy(page);
  const answer = await ask(
    page,
    "Welcher Raum ist morgen um 10 Uhr für 30 Personen frei?",
  );
  await expect(answer).toContainText(/Ende|Dauer|bis wann/i);
  await expect(answer).not.toContainText("Öffentliche Anzeige");
  await expect(answer).not.toContainText("zuerst einen Bereich");
});

test("Freddy prüft alle Demoräume und wiederkehrende Sperren im angefragten Zeitfenster", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-07T08:00:00+02:00") });
  await page.goto("/");
  await expect(page.locator(".calendar-event")).not.toHaveCount(0);
  await page.evaluate(() => {
    const key = "campustime-browser-demo-v1";
    const state = JSON.parse(localStorage.getItem(key)!);
    state.data.rooms.push({
      id: 90001,
      name: "Auditraum",
      floor: state.data.floors[0].id,
      capacity: 1000,
      equipment: [],
    });
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Freddy öffnen", exact: true })
    .click();
  const answer = await ask(
    page,
    "Welcher Raum ist am 2026-10-08 von 10:00 bis 11:00 Uhr für 500 Personen frei?",
  );
  await expect(answer).toContainText("Auditraum");
  await expect(answer).toContainText(/Demo|Browser/i);
  await page.evaluate(() => {
    const key = "campustime-browser-demo-v1";
    const state = JSON.parse(localStorage.getItem(key)!);
    state.data.blocks.push({
      id: 90001,
      name: "Auditsperre",
      rooms: [90001],
      start: "2024-10-03T10:00:00+02:00",
      end: "2024-10-03T11:00:00+02:00",
      repeat_weekly: true,
      repeat_until: "2026-12-31",
    });
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Freddy öffnen", exact: true })
    .click();
  const blocked = await ask(
    page,
    "Welcher Raum ist am 2026-10-08 von 10:00 bis 11:00 Uhr für 500 Personen frei?",
  );
  await expect(blocked).toContainText(/kein|keine/i);
  await expect(blocked).not.toContainText("Auditraum ·");
});

test("Freddy bestätigt keine unvollständig verstandenen Raumbedingungen", async ({
  page,
}) => {
  await openFreddy(page);
  for (const question of [
    "Ist Raum Z999 am 2026-10-08 von 10 bis 11 Uhr für 30 Personen frei?",
    "Welcher Raum ist am 2026-10-08 von 10 bis 11 Uhr für 30 Personen mit PC Aquarium frei?",
    "Welcher Raum in Gebäude X ist am 2026-10-08 von 10 bis 11 Uhr für 30 Personen frei?",
    "Welcher Raum ist am 2026-10-08 von 10 bis 11 Uhr und von 14 bis 15 Uhr für 30 Personen frei?",
    "Welcher Raum ist am 2026-10-25 von 02:15 bis 02:45 Uhr für 30 Personen frei?",
    "Welcher Raum ist am 2026-03-29 von 02:15 bis 03:45 Uhr für 30 Personen frei?",
  ]) {
    const answer = await ask(page, question);
    await expect(answer).toContainText(/eindeutig|unklar|Angaben|Anfrage/i);
    await expect(answer).not.toContainText(
      /nach der Demo-Prüfung|kein passender freier Raum/i,
    );
  }
});

test("Freddy erkennt freie Räume und einen direkt genannten Hörsaal als Datenfrage", async ({
  page,
}) => {
  await openFreddy(page);
  for (const question of [
    "Welche freien Räume gibt es am 08.10.2026 von 16 bis 17 Uhr für 25 Personen?",
    "Ist Hörsaal H.101 am 08.10.2026 von 16 bis 17 Uhr für 25 Personen frei?",
  ]) {
    const answer = await ask(page, question);
    await expect(answer).toContainText("Freddy · Datenprüfung");
    await expect(answer).toContainText(
      /Zeitfenster|passender freier Raum gefunden/,
    );
  }
});

test("Freddy behält Gespräch und Eingabe je Plan und erklärt den ausgewählten Termin", async ({
  page,
}) => {
  const chat = await openFreddy(page);
  await ask(page, "Wie lege ich einen neuen Jahrgang an?");
  await page.getByLabel("Deine Frage an Freddy").fill("Eine offene Rückfrage");
  await chat
    .getByRole("button", { name: "Kontext für Freddy auswählen" })
    .click();
  await chat
    .getByRole("button", {
      name: "dWI24 · Unterricht & Prüfungen",
      exact: true,
    })
    .click();
  await expect(page.locator(".campus-ai-message")).toHaveCount(0);
  await chat
    .getByRole("button", { name: "Kontext für Freddy auswählen" })
    .click();
  await chat
    .getByRole("button", {
      name: "Wirtschaftsinformatik · WS 2026/27",
      exact: true,
    })
    .click();
  await expect(page.locator(".campus-ai-message.assistant")).toContainText(
    "Schritt 5",
  );
  await expect(page.getByLabel("Deine Frage an Freddy")).toHaveValue(
    "Eine offene Rückfrage",
  );
  await page.locator(".calendar-event").first().click();
  await page
    .getByRole("button", { name: "Termin mit Freddy prüfen", exact: true })
    .click();
  await expect(chat.locator(".campus-ai-calendar-context")).toContainText(
    "Mathematik I",
  );
  const answer = await ask(page, "Warum passt dieser Termin nicht?");
  await expect(answer).toContainText("Mathematik I");
  await expect(answer).toContainText(/geprüft|Prüfung|Hinweis|Konflikt/i);
  const compound = await ask(
    page,
    "Warum passt dieser Termin nicht und wer unterrichtet morgen?",
  );
  await expect(compound).toContainText(/eindeutige Anfrage/i);
  await expect(compound).not.toContainText("Mathematik I:");
  const separate = await ask(
    page,
    "Warum passt dieser Termin nicht? Wer unterrichtet morgen?",
  );
  await expect(separate).toContainText(/eindeutige Anfrage/i);
});

test("Freddy erklärt nur Konflikte der ausgewählten Wiederholung eines Termins", async ({
  page,
}) => {
  await openFreddy(page);
  await page.evaluate(() => {
    const key = "campustime-browser-demo-v1";
    const state = JSON.parse(localStorage.getItem(key)!);
    state.data.blocks.push({
      id: 99001,
      name: "Sperre nächste Woche",
      rooms: [1],
      start: "2026-10-12T08:30:00+02:00",
      end: "2026-10-12T10:00:00+02:00",
      repeat_weekly: false,
    });
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Freddy öffnen", exact: true })
    .click();
  await page.getByRole("button", { name: /^Mathematik I ·/ }).click();
  await page
    .getByRole("button", { name: "Termin mit Freddy prüfen", exact: true })
    .click();
  const first = await ask(page, "Warum passt dieser Termin nicht?");
  await expect(first).not.toContainText("blockiert");
  await page
    .getByRole("button", { name: "Nächste Woche", exact: true })
    .click();
  await page.getByRole("button", { name: /^Mathematik I ·/ }).click();
  await page
    .getByRole("button", { name: "Termin mit Freddy prüfen", exact: true })
    .click();
  const second = await ask(page, "Warum passt dieser Termin nicht?");
  await expect(second).toContainText("blockiert");
});

test("Termin-Popup öffnet Freddy mit gespeichertem Kontext und schützt offene Formularänderungen", async ({
  page,
}) => {
  const chat = await openFreddy(page);
  await page.getByLabel("Deine Frage an Freddy").fill("Offene Rückfrage");
  await chat
    .getByRole("button", { name: "Kontext für Freddy auswählen" })
    .click();
  await chat
    .getByRole("button", {
      name: "dWI24 · Unterricht & Prüfungen",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Deine Frage an Freddy")
    .fill("Rückfrage zum anderen Plan");
  await chat
    .getByRole("button", { name: "Chat schließen", exact: true })
    .click();
  await page.locator(".calendar-event").first().click();
  const editor = page.getByRole("dialog", {
    name: "Termin bearbeiten",
    exact: true,
  });
  const assist = editor.getByRole("button", {
    name: "Termin mit Freddy prüfen",
    exact: true,
  });
  const name = editor.getByLabel("Name", { exact: true });
  const original = await name.inputValue();
  await name.fill("Nicht gespeicherte Änderung");
  await expect(assist).toBeDisabled();
  await expect(name).toHaveValue("Nicht gespeicherte Änderung");
  await name.fill(original);
  await expect(assist).toBeEnabled();
  await assist.click();
  await expect(editor).toHaveCount(0);
  await expect(chat).toBeVisible();
  await expect(chat.locator(".campus-ai-calendar-context")).toContainText(
    "Mathematik I",
  );
  await expect(page.getByLabel("Deine Frage an Freddy")).toHaveValue(
    "Offene Rückfrage",
  );
  await expect(page.getByLabel("Deine Frage an Freddy")).toBeFocused();
  await page.locator(".calendar-event").first().click();
  await editor.getByRole("button", { name: "Löschen", exact: true }).click();
  await expect(chat.locator(".campus-ai-calendar-context")).toContainText(
    "Woche ab",
  );
  await expect(chat.locator(".campus-ai-error")).toHaveCount(0);
});

test("Freddy begrenzt lange Raumantworten ohne Räume aus der Prüfung zu verlieren", async ({
  page,
}) => {
  await openFreddy(page);
  await page.evaluate(() => {
    const key = "campustime-browser-demo-v1";
    const state = JSON.parse(localStorage.getItem(key)!);
    for (let index = 0; index < 50; index++)
      state.data.rooms.push({
        id: 91000 + index,
        name: `Test ${index} ${"x".repeat(180)}`,
        floor: state.data.floors[0].id,
        capacity: 1000,
        equipment: [],
      });
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Freddy öffnen", exact: true })
    .click();
  const answer = await ask(
    page,
    "Welcher Raum ist am 2026-10-08 von 10 bis 11 Uhr für 500 Personen frei?",
  );
  await answer
    .getByRole("button", { name: "Vollständige Antwort lesen", exact: true })
    .click();
  await expect(answer).toContainText("50 Räume");
  await expect(answer).toContainText(/weitere Räume/i);
  expect(
    (await answer.locator(".campus-ai-answer").textContent())!.length,
  ).toBeLessThanOrEqual(6000);
  await ask(page, "Welcher Raum ist morgen um 10 Uhr für 30 Personen frei?");
});

test("Freddy bietet eine größere Lesefläche und mobile Schaltflächen", async ({
  page,
}) => {
  const chat = await openFreddy(page);
  await chat
    .getByRole("button", { name: "Freddy vergrößern", exact: true })
    .click();
  const wide = await chat.boundingBox();
  expect(wide!.width).toBeGreaterThan(500);
  await page.locator(".calendar-event").first().click();
  await page.setViewportSize({ width: 1120, height: 900 });
  const withEditor = await chat.boundingBox();
  expect(withEditor!.x).toBeGreaterThanOrEqual(12);
  await page
    .getByRole("button", { name: "Termin mit Freddy prüfen", exact: true })
    .click();
  await chat
    .getByRole("button", { name: "Freddy verkleinern", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addStyleTag({ content: "html { scrollbar-gutter: stable; }" });
  await expect(chat).toBeInViewport();
  const mobile = await chat.boundingBox();
  expect(mobile!.x).toBeGreaterThanOrEqual(8);
  const controls = chat.getByRole("button", {
    name: /Frage senden|Chat schließen|Chat-Optionen/,
  });
  for (const button of await controls.all()) {
    const bounds = await button.boundingBox();
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }
});
