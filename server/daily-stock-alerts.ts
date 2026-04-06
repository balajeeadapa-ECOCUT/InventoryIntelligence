import * as cron from 'node-cron';
import { Resend } from 'resend';
import { storage } from './storage';

const resend = new Resend(process.env.RESEND_API_KEY);

interface StockAlertLog {
    timestamp: Date;
    status: 'success' | 'failed' | 'skipped';
    recipient: string;
    lowStockCount: number;
    outOfStockCount: number;
    error?: string;
}

class DailyStockAlertService {
    private logs: StockAlertLog[] = [];
    private cronJob: ReturnType<typeof cron.schedule> | null = null;

  async generateStockReport(): Promise<{
        lowStockItems: any[];
        outOfStockItems: any[];
        htmlReport: string;
        textReport: string;
  }> {
        const { products } = await storage.getProducts();

      const lowStockItems = products.filter(p =>
              p.currentStock > 0 &&
              (p.currentStock < 10 || p.currentStock <= (p.minStockLevel || 10))
                                                );
        const outOfStockItems = products.filter(p => p.currentStock === 0);

      const formatCurrency = (value: number) =>
              `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const calculateTotalValue = (item: any) =>
                (parseFloat(item.unitPrice) || 0) * (item.currentStock || 0);

      const lowStockTotalValue = lowStockItems.reduce((sum, item) => sum + calculateTotalValue(item), 0);
        const outOfStockCount = outOfStockItems.length;

      const generateTableRows = (items: any[]) =>
              items.map(item => `
                      <tr>
                                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-family: monospace;">${item.sku || 'N/A'}</td>
                                          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.name}</td>
                                                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; ${item.currentStock === 0 ? 'color: #dc2626; font-weight: bold;' : item.currentStock < 10 ? 'color: #f59e0b; font-weight: bold;' : ''}">${item.currentStock}</td>
                                                              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(parseFloat(item.unitPrice) || 0)}</td>
                                                                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(calculateTotalValue(item))}</td>
                                                                                </tr>
                                                                                      `).join('');

      const today = new Date().toLocaleDateString('en-IN', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });

      const htmlReport = `
            <!DOCTYPE html>
                  <html>
                        <head><meta charset="UTF-8"><title>EcoCut Smart Inventory - Daily Stock Alert</title></head>
                              <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f3f4f6;">
                                      <div style="max-width: 800px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                                                <div style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); padding: 30px; color: white;">
                                                            <h1 style="margin: 0; font-size: 24px;">📦 EcoCut Smart Inventory</h1>
                                                                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Daily Stock Alert Report</p>
                                                                                    <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">${today}</p>
                                                                                              </div>
                                                                                                        <div style="padding: 20px; display: flex; gap: 20px;">
                                                                                                                    <div style="flex: 1; background-color: #fef3c7; border-radius: 8px; padding: 20px; text-align: center;">
                                                                                                                                  <div style="font-size: 32px; font-weight: bold; color: #f59e0b;">${lowStockItems.length}</div>
                                                                                                                                                <div style="color: #92400e; font-size: 14px;">Low Stock Items</div>
                                                                                                                                                            </div>
                                                                                                                                                                        <div style="flex: 1; background-color: #fee2e2; border-radius: 8px; padding: 20px; text-align: center;">
                                                                                                                                                                                      <div style="font-size: 32px; font-weight: bold; color: #dc2626;">${outOfStockCount}</div>
                                                                                                                                                                                                    <div style="color: #991b1b; font-size: 14px;">Out of Stock Items</div>
                                                                                                                                                                                                                </div>
                                                                                                                                                                                                                            <div style="flex: 1; background-color: #ede9fe; border-radius: 8px; padding: 20px; text-align: center;">
                                                                                                                                                                                                                                          <div style="font-size: 20px; font-weight: bold; color: #7c3aed;">${formatCurrency(lowStockTotalValue)}</div>
                                                                                                                                                                                                                                                        <div style="color: #5b21b6; font-size: 14px;">Low Stock Value</div>
                                                                                                                                                                                                                                                                    </div>
                                                                                                                                                                                                                                                                              </div>
                                                                                                                                                                                                                                                                                        ${outOfStockItems.length > 0 ? `
                                                                                                                                                                                                                                                                                                  <div style="padding: 20px;">
                                                                                                                                                                                                                                                                                                              <h2 style="color: #dc2626; margin: 0 0 15px 0; font-size: 18px; border-bottom: 2px solid #fee2e2; padding-bottom: 10px;">
                                                                                                                                                                                                                                                                                                                            🚨 Out of Stock Items (${outOfStockItems.length})
                                                                                                                                                                                                                                                                                                                                        </h2>
                                                                                                                                                                                                                                                                                                                                                    <table style="width: 100%; border-collapse: collapse;">
                                                                                                                                                                                                                                                                                                                                                                  <thead>
                                                                                                                                                                                                                                                                                                                                                                                  <tr style="background-color: #fee2e2;">
                                                                                                                                                                                                                                                                                                                                                                                                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #991b1b;">SKU</th>
                                                                                                                                                                                                                                                                                                                                                                                                                      <th style="padding: 12px; text-align: left; font-weight: 600; color: #991b1b;">Product Name</th>
                                                                                                                                                                                                                                                                                                                                                                                                                                        <th style="padding: 12px; text-align: center; font-weight: 600; color: #991b1b;">Stock</th>
                                                                                                                                                                                                                                                                                                                                                                                                                                                          <th style="padding: 12px; text-align: right; font-weight: 600; color: #991b1b;">Unit Price</th>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            <th style="padding: 12px; text-align: right; font-weight: 600; color: #991b1b;">Total Value</th>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            </tr>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          </thead>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <tbody>${generateTableRows(outOfStockItems)}</tbody>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    </table>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              </div>` : ''}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        ${lowStockItems.length > 0 ? `
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  <div style="padding: 20px;">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              <h2 style="color: #f59e0b; margin: 0 0 15px 0; font-size: 18px; border-bottom: 2px solid #fef3c7; padding-bottom: 10px;">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            ⚠️ Low Stock Items (${lowStockItems.length})
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        </h2>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    <table style="width: 100%; border-collapse: collapse;">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  <thead>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  <tr style="background-color: #fef3c7;">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #92400e;">SKU</th>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      <th style="padding: 12px; text-align: left; font-weight: 600; color: #92400e;">Product Name</th>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <th style="padding: 12px; text-align: center; font-weight: 600; color: #92400e;">Stock</th>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          <th style="padding: 12px; text-align: right; font-weight: 600; color: #92400e;">Unit Price</th>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            <th style="padding: 12px; text-align: right; font-weight: 600; color: #92400e;">Total Value</th>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            </tr>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          </thead>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <tbody>${generateTableRows(lowStockItems)}</tbody>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    </table>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              </div>` : ''}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        ${lowStockItems.length === 0 && outOfStockItems.length === 0 ? `
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  <div style="padding: 40px; text-align: center;">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          <h2 style="color: #059669; margin: 0;">All Stock Levels Are Healthy!</h2>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      <p style="color: #6b7280; margin: 10px 0 0 0;">No items require immediate attention.</p>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                </div>` : ''}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      <p style="margin: 0; color: #6b7280; font-size: 12px;">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    This is an automated report from EcoCut Smart Inventory.<br>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  Generated at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              </p>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      </body>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            </html>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                `;

      const generateTextRows = (items: any[]) =>
              items.map(item =>
                        ` ${(item.sku || 'N/A').padEnd(15)} | ${item.name.substring(0, 25).padEnd(25)} | ${String(item.currentStock).padStart(5)} | ${formatCurrency(parseFloat(item.unitPrice) || 0).padStart(12)} | ${formatCurrency(calculateTotalValue(item)).padStart(12)}`
                              ).join('\n');

      const textReport = `
      ================================================================================
      ECOCUT SMART INVENTORY - DAILY STOCK ALERT
      ================================================================================
      Date: ${today}

      SUMMARY
      -------
      Low Stock Items:    ${lowStockItems.length}
      Out of Stock Items: ${outOfStockCount}
      Low Stock Value:    ${formatCurrency(lowStockTotalValue)}

      ${outOfStockItems.length > 0 ? `OUT OF STOCK ITEMS (${outOfStockItems.length})
      ${'='.repeat(80)}
      SKU             | Product Name              | Stock | Unit Price   | Total Value
      ${'-'.repeat(75)}
      ${generateTextRows(outOfStockItems)}
      ` : ''}
      ${lowStockItems.length > 0 ? `LOW STOCK ITEMS (${lowStockItems.length})
      ${'='.repeat(80)}
      SKU             | Product Name              | Stock | Unit Price   | Total Value
      ${'-'.repeat(75)}
      ${generateTextRows(lowStockItems)}
      ` : ''}
      ${lowStockItems.length === 0 && outOfStockItems.length === 0 ? `✅ ALL STOCK LEVELS ARE HEALTHY - No items require immediate attention.` : ''}
      --------------------------------------------------------------------------------
      This is an automated report from EcoCut Smart Inventory.
      Generated at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
      ================================================================================
          `.trim();

      return { lowStockItems, outOfStockItems, htmlReport, textReport };
  }

  async sendDailyAlert(): Promise<StockAlertLog> {
        const dbEnabled = await storage.getSetting('daily_stock_alerts_enabled');
        const dbRecipient = await storage.getSetting('stock_alert_email');
        const enabled = dbEnabled !== null ? dbEnabled === 'true' : process.env.DAILY_STOCK_ALERTS_ENABLED !== 'false';
        const recipient = dbRecipient || process.env.STOCK_ALERT_EMAIL;

      if (!enabled) {
              const log: StockAlertLog = {
                        timestamp: new Date(), status: 'skipped',
                        recipient: recipient || 'not configured',
                        lowStockCount: 0, outOfStockCount: 0,
                        error: 'Daily stock alerts are disabled'
              };
              this.logs.push(log);
              console.log(`[DailyStockAlerts] ${log.timestamp.toISOString()} - Skipped: Alerts disabled`);
              return log;
      }

      if (!recipient) {
              const log: StockAlertLog = {
                        timestamp: new Date(), status: 'skipped',
                        recipient: 'not configured',
                        lowStockCount: 0, outOfStockCount: 0,
                        error: 'STOCK_ALERT_EMAIL not configured'
              };
              this.logs.push(log);
              console.log(`[DailyStockAlerts] ${log.timestamp.toISOString()} - Skipped: No recipient configured`);
              return log;
      }

      try {
              const { lowStockItems, outOfStockItems, htmlReport, textReport } = await this.generateStockReport();

          const subject = outOfStockItems.length > 0
                ? `🚨 URGENT: ${outOfStockItems.length} Items Out of Stock - EcoCut Daily Alert`
                    : lowStockItems.length > 0
                  ? `⚠️ ${lowStockItems.length} Low Stock Items - EcoCut Daily Alert`
                      : `✅ All Stock Healthy - EcoCut Daily Alert`;

          if (process.env.RESEND_API_KEY) {
                    const { error } = await resend.emails.send({
                                from: 'EcoCut Smart Inventory <onboarding@resend.dev>',
                                to: recipient,
                                subject,
                                text: textReport,
                                html: htmlReport,
                    });
                    if (error) {
                                throw new Error(error.message);
                    }
          } else {
                    console.log(`[DailyStockAlerts] SIMULATED EMAIL TO: ${recipient}`);
                    console.log(`[DailyStockAlerts] Subject: ${subject}`);
                    console.log(`[DailyStockAlerts] Low Stock: ${lowStockItems.length}, Out of Stock: ${outOfStockItems.length}`);
          }

          const log: StockAlertLog = {
                    timestamp: new Date(), status: 'success', recipient,
                    lowStockCount: lowStockItems.length,
                    outOfStockCount: outOfStockItems.length,
          };
              this.logs.push(log);
              console.log(`[DailyStockAlerts] ${log.timestamp.toISOString()} - Email sent to ${recipient} (Low: ${lowStockItems.length}, Out: ${outOfStockItems.length})`);
              return log;
      } catch (error: any) {
              const log: StockAlertLog = {
                        timestamp: new Date(), status: 'failed', recipient,
                        lowStockCount: 0, outOfStockCount: 0,
                        error: error.message || 'Unknown error',
              };
              this.logs.push(log);
              console.error(`[DailyStockAlerts] ${log.timestamp.toISOString()} - Failed: ${error.message}`);
              return log;
      }
  }

  startScheduler(): void {
        if (this.cronJob) {
                console.log('[DailyStockAlerts] Scheduler already running');
                return;
        }
        this.cronJob = cron.schedule('30 3 * * *', async () => {
                console.log('[DailyStockAlerts] Running scheduled daily stock alert...');
                await this.sendDailyAlert();
        }, { timezone: 'Asia/Kolkata' });
        console.log('[DailyStockAlerts] Scheduler started - Daily alerts at 9:00 AM IST');
  }

  stopScheduler(): void {
        if (this.cronJob) {
                this.cronJob.stop();
                this.cronJob = null;
                console.log('[DailyStockAlerts] Scheduler stopped');
        }
  }

  getLogs(): StockAlertLog[] {
        return [...this.logs].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  clearLogs(): void {
        this.logs = [];
  }
}

export const dailyStockAlertService = new DailyStockAlertService();
