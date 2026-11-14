import { routeHost, officeSlugFromHost, sessionCookieDomain } from "../apps/web/src/lib/office-host";
import { createOffice, expect, test } from "./helpers";

const text = (page: import("@playwright/test").Page, t: string | RegExp) => page.getByText(t).filter({ visible: true }).first();

test.describe("Subdomain per kantor: aturan routing", () => {
  const prod = { appDomain: "kantoraiku.id", protocol: "https:", search: "", enabled: true };

  test("SUB-U1 host -> slug kantor", () => {
    expect(officeSlugFromHost("studio-senja.kantoraiku.id", "kantoraiku.id")).toBe("studio-senja");
    expect(officeSlugFromHost("STUDIO.kantoraiku.id", "kantoraiku.id")).toBe("studio");
    expect(officeSlugFromHost("kantoraiku.id", "kantoraiku.id")).toBeNull();
    expect(officeSlugFromHost("www.kantoraiku.id", "kantoraiku.id")).toBeNull();
    expect(officeSlugFromHost("a.b.kantoraiku.id", "kantoraiku.id")).toBeNull();
    expect(officeSlugFromHost("studio.kantoraiku.id.jahat.com", "kantoraiku.id")).toBeNull();
    expect(officeSlugFromHost("studio.localhost:3000", "localhost:3000")).toBe("studio");
  });

  test("SUB-U2 keputusan routing", () => {
    const at = (host: string, pathname: string) => routeHost({ ...prod, host, pathname });
    expect(at("studio.kantoraiku.id", "/")).toEqual({ type: "rewrite", path: "/o/studio" });
    expect(at("studio.kantoraiku.id", "/agent/baru")).toEqual({ type: "rewrite", path: "/o/studio/agent/baru" });
    expect(at("studio.kantoraiku.id", "/masuk")).toEqual({ type: "rewrite", path: "/o/studio/masuk" });
    expect(at("studio.kantoraiku.id", "/o/studio/tugas")).toEqual({ type: "next" });
    expect(at("studio.kantoraiku.id", "/o/lain/tugas")).toEqual({ type: "redirect", url: "https://lain.kantoraiku.id/tugas" });
    expect(at("studio.kantoraiku.id", "/beli")).toEqual({ type: "redirect", url: "https://kantoraiku.id/beli" });
    expect(at("studio.kantoraiku.id", "/auth/confirm")).toEqual({ type: "redirect", url: "https://kantoraiku.id/auth/confirm" });
    expect(at("kantoraiku.id", "/o/studio/agent")).toEqual({ type: "redirect", url: "https://studio.kantoraiku.id/agent" });
    expect(at("kantoraiku.id", "/beli")).toEqual({ type: "next" });
    expect(routeHost({ ...prod, enabled: false, host: "studio.localhost:3000", appDomain: "localhost:3000", pathname: "/beli" })).toEqual({ type: "next" });
    expect(routeHost({ ...prod, enabled: false, host: "studio.localhost:3000", appDomain: "localhost:3000", pathname: "/" })).toEqual({ type: "rewrite", path: "/o/studio" });
    // Dev tanpa OFFICE_SUBDOMAINS: domain utama tetap memakai /o/{slug}.
    expect(routeHost({ ...prod, enabled: false, host: "localhost:3000", appDomain: "localhost:3000", pathname: "/o/studio" })).toEqual({ type: "next" });
  });

  test("SUB-U3 cookie sesi di domain induk hanya di production", () => {
    expect(sessionCookieDomain({ NODE_ENV: "production", APP_DOMAIN: "kantoraiku.id" })).toBe(".kantoraiku.id");
    expect(sessionCookieDomain({ NODE_ENV: "development", APP_DOMAIN: "kantoraiku.id" })).toBeUndefined();
    expect(sessionCookieDomain({ NODE_ENV: "production", APP_DOMAIN: "localhost:3000" })).toBeUndefined();
  });
});

test.describe("Subdomain per kantor: di browser (slug.localhost)", () => {
  test("SUB-H1 buka subdomain -> masuk -> kantor di alamat bersih, path /o/ tetap jalan", async ({ page }) => {
    const f = await createOffice();
    const base = `http://${f.slug}.localhost:3000`;

    await page.goto(`${base}/`);
    await expect(page).toHaveURL(new RegExp(`^${base}/o/${f.slug}/masuk`)); // belum login: halaman masuk kantor itu
    await page.getByLabel("Email", { exact: true }).filter({ visible: true }).first().fill(f.email);
    await page.getByLabel("Password", { exact: true }).filter({ visible: true }).first().fill(f.password);
    await page.getByRole("button", { name: "Masuk" }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(`${base}/o/${f.slug}`);
    await expect(page.getByRole("heading", { name: "Kantor", level: 1 }).filter({ visible: true }).first()).toBeVisible();

    await page.goto(`${base}/agent`);
    await expect(page.getByRole("heading", { name: "Agent", level: 1 }).filter({ visible: true }).first()).toBeVisible();
    expect(page.url()).toBe(`${base}/agent`);

    await page.getByRole("link", { name: "Tugas" }).filter({ visible: true }).first().click();
    await expect(page.getByRole("heading", { name: "Tugas", level: 1 }).filter({ visible: true }).first()).toBeVisible();
    expect(new URL(page.url()).host).toBe(`${f.slug}.localhost:3000`);
  });

  test("SUB-N1 dari subdomain: kantor lain dialihkan ke subdomainnya, halaman jualan ke domain utama", async ({ page }) => {
    const a = await createOffice();
    const b = await createOffice();
    // Navigasi browser (resolver Node tidak mengenal *.localhost): berakhir di halaman masuk kantor B, di subdomain B.
    await page.goto(`http://${a.slug}.localhost:3000/o/${b.slug}/agent`);
    await expect(page).toHaveURL(new RegExp(`^http://${b.slug}\.localhost:3000/o/${b.slug}/masuk`));

    // Dev: halaman jualan tetap tampil di subdomain (pengalihan ke domain utama hanya di production, diuji di SUB-U2).
    await page.goto(`http://${a.slug}.localhost:3000/beli`);
    await expect(text(page, "Buat kantor kamu")).toBeVisible();
  });

  test("SUB-N2 subdomain kantor yang tidak ada: tidak ditemukan", async ({ page }) => {
    await page.goto("http://kantor-tidak-ada-xyz.localhost:3000/");
    await expect(page.getByText(/could not be found|tidak ditemukan/i).first()).toBeVisible();
  });
});
