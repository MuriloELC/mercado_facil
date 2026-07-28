import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  Browser,
  BrowserContext,
  Page,
  chromium,
} from 'playwright';

type PlaywrightSession = {
  queueItemId: string;
  adminUserId: string;
  consultationUrl: string;
  startedAt: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
};

@Injectable()
export class NfcePlaywrightService implements OnModuleDestroy {
  private readonly sessions = new Map<string, PlaywrightSession>();

  async onModuleDestroy(): Promise<void> {
    for (const session of this.sessions.values()) {
      await this.safeCloseSession(session);
    }
    this.sessions.clear();
  }

  async startSession(
    queueItemId: string,
    consultationUrl: string,
    adminUserId: string,
  ): Promise<{
    queue_item_id: string;
    url: string;
    title: string;
    started_at: string;
    headless: boolean;
  }> {
    if (!/^https?:\/\//i.test(consultationUrl)) {
      throw new BadRequestException('Invalid consultation URL for Playwright session.');
    }

    await this.closeSession(queueItemId).catch(() => undefined);

    const headless = (process.env.PLAYWRIGHT_HEADLESS ?? 'false') === 'true';
    const slowMo = Number(process.env.PLAYWRIGHT_SLOW_MO ?? 0);

    const browser = await chromium.launch({
      headless,
      slowMo,
    });

    const context = await browser.newContext({
      viewport: {
        width: 1280,
        height: 900,
      },
      locale: 'pt-BR',
    });

    const page = await context.newPage();
    await page.goto(consultationUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    const startedAt = new Date().toISOString();
    const session: PlaywrightSession = {
      queueItemId,
      adminUserId,
      consultationUrl,
      startedAt,
      browser,
      context,
      page,
    };

    this.sessions.set(queueItemId, session);

    return {
      queue_item_id: queueItemId,
      url: page.url(),
      title: await page.title(),
      started_at: startedAt,
      headless,
    };
  }

  async getSessionState(queueItemId: string): Promise<{
    active: boolean;
    queue_item_id: string;
    started_at?: string;
    current_url?: string;
    title?: string;
  }> {
    const session = this.sessions.get(queueItemId);
    if (!session) {
      return {
        active: false,
        queue_item_id: queueItemId,
      };
    }

    return {
      active: true,
      queue_item_id: queueItemId,
      started_at: session.startedAt,
      current_url: session.page.url(),
      title: await session.page.title(),
    };
  }

  async captureHtml(queueItemId: string): Promise<{
    html: string;
    current_url: string;
    title: string;
  }> {
    const session = this.sessions.get(queueItemId);
    if (!session) {
      throw new NotFoundException('No active Playwright session for this queue item.');
    }

    await this.tryNavigateToDetailedPage(session.page);

    const html = await session.page.content();
    const currentUrl = session.page.url();
    const title = await session.page.title();

    if (!html || html.length < 100) {
      throw new BadRequestException('Current Playwright page HTML is empty.');
    }

    return {
      html,
      current_url: currentUrl,
      title,
    };
  }

  private async tryNavigateToDetailedPage(page: Page): Promise<void> {
    const currentUrl = page.url();
    if (/tipo=detalhada/i.test(currentUrl)) {
      return;
    }

    const detailedHref = await page
      .locator('a[href*="tipo=detalhada"]')
      .first()
      .getAttribute('href')
      .catch(() => null);

    if (!detailedHref) {
      return;
    }

    const detailedUrl = new URL(detailedHref, currentUrl).toString();
    await page.goto(detailedUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
  }

  async closeSession(queueItemId: string): Promise<void> {
    const session = this.sessions.get(queueItemId);
    if (!session) {
      return;
    }

    await this.safeCloseSession(session);
    this.sessions.delete(queueItemId);
  }

  private async safeCloseSession(session: PlaywrightSession): Promise<void> {
    try {
      await session.context.close();
    } catch {
      // ignore cleanup errors
    }

    try {
      await session.browser.close();
    } catch {
      // ignore cleanup errors
    }
  }
}
