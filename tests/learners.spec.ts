import { test, expect, Page } from "@playwright/test";

async function openLearners(page: Page) {
  await page
    .getByRole("navigation", { name: "Arbeitsbereiche" })
    .getByRole("button", { name: "Schüler & Studierende", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Schüler & Studierende", exact: true }),
  ).toBeVisible();
}

async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Passwort", { exact: true }).fill("WikiBuildOnly2026!");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await openLearners(page);
}

test("learner tiles reuse the planning selection and open filtered person lists", async ({
  page,
}) => {
  await login(page);
  const tiles = page.getByRole("button", { name: "Kacheln", exact: true });
  const list = page.getByRole("button", { name: "Liste", exact: true });
  await expect(list).toHaveAttribute("aria-pressed", "true");
  const groups = (
    await (await page.request.get("/api/groups/?page_size=1000")).json()
  ).results;
  const group = groups[0];
  await tiles.click();
  await expect(tiles).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator(".planning-selection .selection-year").first(),
  ).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);
  await page
    .getByRole("button", { name: `Gruppe ${group.name} öffnen`, exact: true })
    .click();
  await expect(list).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Gruppe / Klasse filtern")).toHaveValue(
    String(group.id),
  );
  await expect(page.getByLabel("Jahrgang filtern")).toHaveValue(
    String(group.cohort),
  );
  const assigned = (
    await (
      await page.request.get(
        `/api/people/?kind=learner&groups=${group.id}&page_size=50`,
      )
    ).json()
  ).results;
  await expect(page.locator(".learner-row")).toHaveCount(assigned.length);
  if (assigned.length) {
    await expect(page.locator(".learner-row").first()).toContainText(
      group.name,
    );
    await page
      .getByRole("button", { name: "Person hinzufügen", exact: true })
      .click();
    await expect(
      page.getByRole("dialog").locator(".selected-chips"),
    ).toContainText(group.name);
    await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  }
  await tiles.click();
  await list.click();
  await expect(page.getByLabel("Gruppe / Klasse filtern")).toHaveValue(
    String(group.id),
  );
  await tiles.click();
  await page.reload();
  await openLearners(page);
  await expect(tiles).toHaveAttribute("aria-pressed", "true");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator(".selection-group").first()).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "Ohne Zuordnung", exact: true })
    .click();
  await expect(list).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Gruppe / Klasse filtern")).toHaveValue(
    "unassigned",
  );
});

test("people can share a name, retain individual identifiers and change group assignments", async ({
  page,
}) => {
  test.setTimeout(60000);
  await login(page);
  const groups = (
    await (await page.request.get("/api/groups/?page_size=1000")).json()
  ).results as { id: number; name: string; cohort: number }[];
  const group = groups.find(
    (candidate) =>
      groups.filter((item) => item.cohort === candidate.cohort).length > 1,
  )!;
  const second = groups.find(
    (item) => item.cohort === group.cohort && item.id !== group.id,
  )!;
  const other = groups.find((item) => item.cohort !== group.cohort)!;
  expect(group && second && other).toBeTruthy();
  const name = `Browser Zuordnung ${Date.now()}`;
  const search = page.getByRole("textbox", {
    name: "Personen suchen",
    exact: true,
  });
  await search.fill(name);
  await page
    .getByRole("button", { name: "Person hinzufügen", exact: true })
    .click();
  const add = page.getByRole("dialog", {
    name: "Person hinzufügen",
    exact: true,
  });
  await add.getByLabel(/^Name/).fill(name);
  await expect(add.getByLabel(/^Kennung \(optional\)/)).toHaveValue("");
  await add
    .getByRole("combobox", { name: "Jahrgang", exact: true })
    .selectOption(String(group.cohort));
  const choices = add.getByRole("combobox", {
    name: "Gruppen & Klassen",
    exact: true,
  });
  await expect(choices.locator(`option[value="${group.id}"]`)).toHaveCount(1);
  await expect(choices.locator(`option[value="${other.id}"]`)).toHaveCount(0);
  await choices.selectOption(String(group.id));
  await choices.selectOption(String(second.id));
  const firstSave = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/people/") &&
      response.request().method() === "POST",
  );
  await add.getByRole("button", { name: "Speichern", exact: true }).click();
  const person = await (await firstSave).json();
  expect(person.kind).toBe("learner");
  expect(person.code.length).toBeGreaterThan(0);
  expect(person.groups.sort()).toEqual([group.id, second.id].sort());
  await expect(add).toHaveCount(0);
  const row = page.locator(".learner-row").filter({ hasText: person.code });
  await expect(row).toContainText(name);
  await expect(row).toContainText(group.name);
  await expect(row).toContainText(second.name);

  await page
    .getByRole("button", { name: "Person hinzufügen", exact: true })
    .click();
  await add.getByLabel(/^Name/).fill(name);
  const code = `BROWSER-${Date.now()}`;
  await add.getByLabel(/^Kennung \(optional\)/).fill(code);
  const secondSave = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/people/") &&
      response.request().method() === "POST",
  );
  await add.getByRole("button", { name: "Speichern", exact: true }).click();
  const namesake = await (await secondSave).json();
  expect(namesake.id).not.toBe(person.id);
  expect(namesake.code).toBe(code);
  expect(namesake.groups).toEqual([]);
  const rows = page.locator(".learner-row").filter({ hasText: name });
  await expect(rows).toHaveCount(2);

  const cohortFilter = page.getByLabel("Jahrgang filtern", { exact: true });
  const groupFilter = page.getByLabel("Gruppe / Klasse filtern", {
    exact: true,
  });
  await cohortFilter.selectOption(String(group.cohort));
  await expect(rows).toHaveCount(1);
  await groupFilter.selectOption(String(group.id));
  await expect(row).toBeVisible();
  await cohortFilter.selectOption("");
  await groupFilter.selectOption("unassigned");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(code);
  await groupFilter.selectOption("");

  await row.getByRole("button", { name: "Bearbeiten", exact: true }).click();
  const edit = page.getByRole("dialog", {
    name: "Person bearbeiten",
    exact: true,
  });
  await edit
    .locator(".selected-chips button")
    .filter({ hasText: group.name })
    .click();
  await edit
    .locator(".selected-chips button")
    .filter({ hasText: second.name })
    .click();
  await edit.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(edit).toHaveCount(0);
  await groupFilter.selectOption("unassigned");
  await expect(rows).toHaveCount(2);
  await groupFilter.selectOption("");
  await row.getByRole("button", { name: "Bearbeiten", exact: true }).click();
  await edit
    .getByRole("combobox", { name: "Jahrgang", exact: true })
    .selectOption(String(other.cohort));
  await edit
    .getByRole("combobox", { name: "Gruppen & Klassen", exact: true })
    .selectOption(String(other.id));
  await edit.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(edit).toHaveCount(0);
  await expect(row).toContainText(other.name);
  await page.reload();
  await openLearners(page);
  await search.fill(name);
  await expect(rows).toHaveCount(2);
  await expect(row).toContainText(other.name);
  const persisted = await (
    await page.request.get(`/api/people/${person.id}/`)
  ).json();
  expect(persisted.groups).toEqual([other.id]);
  expect(persisted.code).toBe(person.code);
  await search.fill("");
  await expect
    .poll(() => page.locator(".learner-row").count())
    .toBeGreaterThan(2);
  await page.screenshot({
    path: ".playwright/learners-light.png",
    animations: "disabled",
  });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: ".playwright/learners-dark.png",
    animations: "disabled",
  });
});

test("learner forms keep typing focus and remain usable on a narrow dark screen", async ({
  page,
}) => {
  // Local-network administration can run without the secure-context UUID helper.
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(crypto, "randomUUID", {
      configurable: true,
      value: undefined,
    });
  });
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .getByRole("button", { name: "Person hinzufügen", exact: true })
    .click();
  const form = page.getByRole("dialog", {
    name: "Person hinzufügen",
    exact: true,
  });
  expect(errors).toEqual([]);
  await expect(form).toBeVisible();
  const name = form.getByLabel(/^Name/);
  await name.focus();
  for (const character of "Kim Müller") {
    await page.keyboard.type(character);
    await expect(name).toBeFocused();
  }
  await expect(name).toHaveValue("Kim Müller");
  const identifier = form.getByLabel(/^Kennung \(optional\)/);
  await identifier.focus();
  for (const character of `MOBIL-${Date.now()}`) {
    await page.keyboard.type(character);
    await expect(identifier).toBeFocused();
  }
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: ".playwright/learner-form-mobile-dark.png",
    animations: "disabled",
  });
  await form.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(form).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Personen suchen", exact: true })
    .fill("Kim Müller");
  await expect(
    page.locator(".learner-row").filter({ hasText: "Kim Müller" }),
  ).toHaveCount(1);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: ".playwright/learners-mobile-dark.png",
    animations: "disabled",
  });
});

test("structured identity and personal access preserve edits and reveal passwords only once", async ({
  page,
}) => {
  test.setTimeout(60000);
  await login(page);
  const stamp = Date.now();
  const email = `alex.${stamp}@example.org`;
  const code = `PERSONAL-${stamp}`;
  await page
    .getByRole("button", { name: "Person hinzufügen", exact: true })
    .click();
  let edit = page.getByRole("dialog", {
    name: "Person hinzufügen",
    exact: true,
  });
  await edit.getByLabel("Vorname", { exact: true }).fill("Alex");
  await edit.getByLabel("Nachname", { exact: true }).fill(`Muster ${stamp}`);
  await expect(edit.getByLabel("Name", { exact: true })).toHaveValue(
    `Alex Muster ${stamp}`,
  );
  await edit.getByLabel("E-Mail (optional)", { exact: true }).fill(email);
  await edit.getByLabel("Kennung (optional)", { exact: true }).fill(code);
  const save = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/people/") &&
      response.request().method() === "POST",
  );
  await edit.getByRole("button", { name: "Speichern", exact: true }).click();
  const person = await (await save).json();
  expect(person.first_name).toBe("Alex");
  expect(person.last_name).toBe(`Muster ${stamp}`);
  expect(person.email).toBe(email);
  await page.getByLabel("Personen suchen", { exact: true }).fill(email);
  const row = page.locator(".learner-row").filter({ hasText: code });
  await expect(row).toContainText(email);
  await row.getByRole("button", { name: "Bearbeiten", exact: true }).click();
  edit = page.getByRole("dialog", { name: "Person bearbeiten", exact: true });
  const openAccess = edit.getByRole("button", {
    name: "Persönlicher Zugang",
    exact: true,
  });
  await edit.getByLabel("Name", { exact: true }).fill("Andere Anzeige");
  await expect(openAccess).toBeDisabled();
  page.once("dialog", (dialog) => dialog.dismiss());
  await edit.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await expect(edit.getByLabel("Name", { exact: true })).toHaveValue(
    "Andere Anzeige",
  );
  await edit.getByLabel("Name", { exact: true }).fill(person.name);
  await openAccess.click();
  const access = page.getByRole("dialog", {
    name: "Persönlicher Zugang",
    exact: true,
  });
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await access
    .getByLabel("Benutzername vorschlagen aus")
    .selectOption("identifier");
  const suggestions = await (
    await page.request.get(`/api/people/${person.id}/access/`)
  ).json();
  await expect(access.getByLabel("Benutzername", { exact: true })).toHaveValue(
    suggestions.suggestions.identifier,
  );
  const username = `alex.${stamp}`;
  await access.getByLabel("Benutzername", { exact: true }).fill(username);
  await access.getByLabel("Serveradresse").fill("https://campus.example.org");
  const create = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/people/${person.id}/access/`) &&
      response.request().method() === "POST",
  );
  await access
    .getByRole("button", { name: "Zugang erstellen", exact: true })
    .click();
  const created = await (await create).json();
  expect(created.password).toBeTruthy();
  expect(created.username).toBe(username);
  const credentials = access.getByLabel("Zugangsdaten zum Weitergeben");
  await expect.poll(() => credentials.inputValue()).toContain(created.password);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    document.execCommand = () => false;
  });
  await access.getByRole("button", { name: "Zugangsdaten kopieren" }).click();
  await expect(
    access.getByRole("status").filter({ hasText: "manuell kopieren" }),
  ).toBeVisible();
  await access.getByRole("button", { name: "Zurück", exact: true }).click();
  await expect(edit).toBeVisible();
  await openAccess.click();
  await expect(access.getByLabel("Benutzername", { exact: true })).toHaveValue(
    username,
  );
  await expect(access.getByLabel("Zugangsdaten zum Weitergeben")).toHaveCount(
    0,
  );
  const stored = await (
    await page.request.get(`/api/people/${person.id}/access/`)
  ).json();
  expect(stored.password).toBeUndefined();
  page.once("dialog", (dialog) => dialog.dismiss());
  await access
    .getByRole("button", { name: "Passwort zurücksetzen", exact: true })
    .click();
  await expect(access.getByLabel("Zugangsdaten zum Weitergeben")).toHaveCount(
    0,
  );
  page.once("dialog", (dialog) => dialog.accept());
  const reset = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/people/${person.id}/access/`) &&
      response.request().method() === "POST",
  );
  await access
    .getByRole("button", { name: "Passwort zurücksetzen", exact: true })
    .click();
  const changed = await (await reset).json();
  expect(changed.username).toBe(username);
  expect(changed.password).not.toBe(created.password);
  await expect.poll(() => credentials.inputValue()).toContain(changed.password);
  page.once("dialog", (dialog) => dialog.accept());
  await access
    .getByRole("button", { name: "Zugang sperren", exact: true })
    .click();
  await expect(access.getByRole("status")).toContainText("Zugang gesperrt");
  await expect(credentials).toHaveCount(0);
  await access.getByRole("button", { name: "Zurück", exact: true }).click();
  await edit.getByRole("button", { name: "Abbrechen", exact: true }).click();
});

test("legacy teacher names remain intact and personal access is reachable in setup and overview", async ({
  page,
}) => {
  await login(page);
  const stamp = Date.now();
  const csrf =
    (await page.context().cookies()).find(
      (cookie) => cookie.name === "csrftoken",
    )?.value || "";
  const teacherResponse = await page.request.post("/api/people/", {
    headers: { "X-CSRFToken": csrf },
    data: {
      name: `Dr. Legacy ${stamp}`,
      code: `TEACHER-${stamp}`,
      kind: "teacher",
    },
  });
  expect(teacherResponse.ok()).toBe(true);
  const teacher = await teacherResponse.json();
  await page
    .getByRole("navigation", { name: "Arbeitsbereiche" })
    .getByRole("button", { name: "Einrichtung & Studienstruktur", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Schritt 2: Lehrende", exact: true })
    .click();
  await page.getByRole("button").filter({ hasText: teacher.name }).click();
  const edit = page.getByRole("dialog", {
    name: "Eintrag bearbeiten",
    exact: true,
  });
  await expect(edit.getByLabel("Name", { exact: true })).toHaveValue(
    teacher.name,
  );
  await expect(edit.getByLabel("Vorname", { exact: true })).toHaveValue("");
  await expect(edit.getByLabel("Nachname", { exact: true })).toHaveValue("");
  await edit.getByLabel("Vorname", { exact: true }).fill("Mara");
  await edit.getByLabel("Nachname", { exact: true }).fill(`Lehre ${stamp}`);
  await expect(edit.getByLabel("Name", { exact: true })).toHaveValue(
    `Mara Lehre ${stamp}`,
  );
  await expect(
    edit.getByRole("button", { name: "Persönlicher Zugang", exact: true }),
  ).toBeDisabled();
  await edit.getByRole("button", { name: "Speichern", exact: true }).click();
  await page
    .getByRole("button")
    .filter({ hasText: `Mara Lehre ${stamp}` })
    .click();
  await edit
    .getByRole("button", { name: "Persönlicher Zugang", exact: true })
    .click();
  const access = page.getByRole("dialog", {
    name: "Persönlicher Zugang",
    exact: true,
  });
  await expect(
    access.getByRole("button", { name: "Zugang erstellen", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await access.getByRole("button", { name: "Zurück", exact: true }).click();
  await edit.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Arbeitsbereiche" })
    .getByRole("button", { name: "Lehrendenübersicht", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: `Mara Lehre ${stamp}: Verfügbarkeit bearbeiten`,
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog", { name: "Verfügbarkeit bearbeiten", exact: true })
    .getByRole("button", { name: "Persönlicher Zugang", exact: true })
    .click();
  await expect(
    access.getByRole("button", { name: "Zugang erstellen", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
});
