/**
 * 上海如静知华信息科技有限公司 https://www.zhuatech.cn/
 * 商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。
 */
import crypto from 'node:crypto';
const now = () => new Date().toISOString();
const uid = (p) => `${p}_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
const clone = (v) => structuredClone(v);
const required = (v, n) => { if (v === undefined || v === null || String(v).trim() === '') throw new Error(`${n}不能为空`); return String(v).trim(); };

/**
 * 排队叫号领域服务，覆盖网点、窗口、业务、取号、优先队列、叫号、转派、过号、办结与SLA。
 * 商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。
 */
export class QueueService {
  /** 初始化排队叫号领域状态。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  constructor(seed = {}) {
    for (const key of ['sites', 'windows', 'services', 'terminals', 'tickets', 'announcements']) this[key] = new Map((seed[key] || []).map((x) => [x.id, x]));
    this.audit = seed.audit || [];
    this.sequences = new Map(seed.sequences || []);
  }

  /** 新建办事网点并配置营业时间。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  createSite(input, actor = 'admin') {
    const code = required(input.code, '网点编码');
    if ([...this.sites.values()].some((x) => x.code === code)) throw new Error('网点编码已存在');
    const site = { id: uid('site'), code, name: required(input.name, '网点名称'), address: required(input.address, '地址'), businessHours: input.businessHours || '08:30-17:30', status: 'open', createdAt: now() };
    this.sites.set(site.id, site); this.#record(actor, 'SITE_CREATED', site.id, { code }); return clone(site);
  }

  /** 配置业务类型、票号前缀与服务时限。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  createServiceType(input, actor = 'admin') {
    if (!this.sites.has(input.siteId)) throw new Error('网点不存在');
    const prefix = required(input.prefix, '票号前缀').toUpperCase();
    if (!/^[A-Z]{1,3}$/.test(prefix)) throw new Error('票号前缀需为1至3位字母');
    if ([...this.services.values()].some((x) => x.siteId === input.siteId && x.prefix === prefix)) throw new Error('票号前缀已存在');
    const service = { id: uid('biz'), siteId: input.siteId, name: required(input.name, '业务名称'), prefix, slaMinutes: Number(input.slaMinutes || 15), enabled: true, createdAt: now() };
    this.services.set(service.id, service); this.#record(actor, 'SERVICE_TYPE_CREATED', service.id, { prefix }); return clone(service);
  }

  /** 配置服务窗口与可受理业务范围。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  createWindow(input, actor = 'admin') {
    if (!this.sites.has(input.siteId)) throw new Error('网点不存在');
    const number = required(input.number, '窗口号');
    if ([...this.windows.values()].some((x) => x.siteId === input.siteId && x.number === number)) throw new Error('窗口号已存在');
    const serviceIds = Array.isArray(input.serviceIds) ? input.serviceIds : [];
    if (!serviceIds.length || serviceIds.some((id) => !this.services.has(id))) throw new Error('窗口至少绑定一个有效业务');
    const win = { id: uid('win'), siteId: input.siteId, number, name: input.name || `${number}号窗口`, serviceIds, operator: input.operator || null, status: 'available', currentTicketId: null, createdAt: now() };
    this.windows.set(win.id, win); this.#record(actor, 'WINDOW_CREATED', win.id, { number }); return clone(win);
  }

  /** 注册取号机或叫号屏终端。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  registerTerminal(input, actor = 'engineer') {
    if (!this.sites.has(input.siteId)) throw new Error('网点不存在');
    const code = required(input.code, '终端编码');
    if ([...this.terminals.values()].some((x) => x.code === code)) throw new Error('终端编码已存在');
    const terminal = { id: uid('term'), siteId: input.siteId, code, type: input.type || 'ticket-kiosk', status: 'online', appVersion: input.appVersion || '1.0.0', token: crypto.randomBytes(18).toString('hex'), lastHeartbeatAt: now(), createdAt: now() };
    this.terminals.set(terminal.id, terminal); this.#record(actor, 'TERMINAL_REGISTERED', terminal.id, { type: terminal.type }); return clone(terminal);
  }

  /** 取号并按网点、业务与日期生成连续票号。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  issueTicket(input, actor = 'kiosk') {
    const service = this.services.get(input.serviceId);
    if (!service || !service.enabled) throw new Error('业务当前不可取号');
    const site = this.sites.get(service.siteId);
    if (site.status !== 'open') throw new Error('网点当前停止取号');
    const date = now().slice(0, 10).replaceAll('-', '');
    const sequenceKey = `${service.id}:${date}`;
    const seq = (this.sequences.get(sequenceKey) || 0) + 1;
    this.sequences.set(sequenceKey, seq);
    const priority = ['normal', 'appointment', 'care'].includes(input.priority) ? input.priority : 'normal';
    const ticket = { id: uid('ticket'), siteId: site.id, serviceId: service.id, number: `${service.prefix}${String(seq).padStart(3, '0')}`, maskedMobile: input.mobile ? `${String(input.mobile).slice(0, 3)}****${String(input.mobile).slice(-4)}` : null, priority, status: 'waiting', issuedAt: now(), calledAt: null, completedAt: null, windowId: null, callCount: 0 };
    this.tickets.set(ticket.id, ticket); this.#record(actor, 'TICKET_ISSUED', ticket.id, { number: ticket.number, priority }); return clone(ticket);
  }

  /** 按关爱/预约/普通优先级和等候时间选择下一票并叫号。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  callNext(windowId, actor = 'operator') {
    const win = this.windows.get(windowId);
    if (!win || win.status !== 'available') throw new Error('窗口当前不可叫号');
    const rank = { care: 0, appointment: 1, normal: 2 };
    const candidates = [...this.tickets.values()].filter((x) => x.siteId === win.siteId && win.serviceIds.includes(x.serviceId) && x.status === 'waiting').sort((a, b) => rank[a.priority] - rank[b.priority] || Date.parse(a.issuedAt) - Date.parse(b.issuedAt));
    if (!candidates.length) throw new Error('当前没有等待票号');
    const ticket = candidates[0]; ticket.status = 'called'; ticket.windowId = win.id; ticket.calledAt = now(); ticket.callCount += 1;
    win.status = 'serving'; win.currentTicketId = ticket.id;
    this.#record(actor, 'TICKET_CALLED', ticket.id, { windowId: win.id }); return clone(ticket);
  }

  /** 对已叫票进行重呼，限制最多三次。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  recall(ticketId, actor = 'operator') {
    const ticket = this.tickets.get(ticketId);
    if (!ticket || ticket.status !== 'called') throw new Error('票号当前不可重呼');
    if (ticket.callCount >= 3) throw new Error('重呼次数已达上限');
    ticket.callCount += 1; ticket.lastRecalledAt = now(); this.#record(actor, 'TICKET_RECALLED', ticket.id, { callCount: ticket.callCount }); return clone(ticket);
  }

  /** 将已叫票转移到另一个可受理窗口。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  transfer(ticketId, targetWindowId, actor = 'operator') {
    const ticket = this.tickets.get(ticketId); const source = ticket ? this.windows.get(ticket.windowId) : null; const target = this.windows.get(targetWindowId);
    if (!ticket || ticket.status !== 'called') throw new Error('票号当前不可转派');
    if (!target || target.status !== 'available' || !target.serviceIds.includes(ticket.serviceId)) throw new Error('目标窗口不可受理');
    if (source) { source.status = 'available'; source.currentTicketId = null; }
    ticket.windowId = target.id; ticket.callCount += 1; ticket.transferredAt = now(); target.status = 'serving'; target.currentTicketId = ticket.id;
    this.#record(actor, 'TICKET_TRANSFERRED', ticket.id, { targetWindowId }); return clone(ticket);
  }

  /** 将已叫票标记过号并释放窗口。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  markNoShow(ticketId, actor = 'operator') { return this.#finish(ticketId, 'no-show', actor); }

  /** 办结已叫票并记录办理结果和耗时。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  complete(ticketId, result, actor = 'operator') {
    const ticket = this.#finish(ticketId, 'completed', actor); ticket.result = required(result, '办理结果'); this.tickets.set(ticket.id, ticket); return clone(ticket);
  }

  /** 暂停或恢复网点取号。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  setSiteStatus(siteId, status, actor = 'manager') {
    const site = this.sites.get(siteId); if (!site) throw new Error('网点不存在'); if (!['open', 'paused'].includes(status)) throw new Error('状态不支持'); site.status = status; this.#record(actor, 'SITE_STATUS_CHANGED', site.id, { status }); return clone(site);
  }

  /** 汇总实时等候、服务中、超时与窗口利用率。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  dashboard() {
    const tickets = [...this.tickets.values()]; const windows = [...this.windows.values()];
    const waiting = tickets.filter((x) => x.status === 'waiting');
    return { metrics: { waiting: waiting.length, serving: tickets.filter((x) => x.status === 'called').length, completed: tickets.filter((x) => x.status === 'completed').length, noShow: tickets.filter((x) => x.status === 'no-show').length, openWindows: windows.filter((x) => x.status !== 'offline').length, avgWaitMinutes: tickets.filter((x) => x.calledAt).length ? Math.round(tickets.filter((x) => x.calledAt).reduce((s, x) => s + (Date.parse(x.calledAt) - Date.parse(x.issuedAt)) / 60000, 0) / tickets.filter((x) => x.calledAt).length) : 0 }, sites: [...this.sites.values()], services: [...this.services.values()], windows, waiting: waiting.slice(0, 30), recentCalls: tickets.filter((x) => x.status === 'called').slice(-12).reverse(), audit: this.audit.slice(-30).reverse() };
  }

  /** 导出本地持久化快照。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  dump() { const out = { audit: this.audit, sequences: [...this.sequences.entries()] }; for (const k of ['sites', 'windows', 'services', 'terminals', 'tickets', 'announcements']) out[k] = [...this[k].values()]; return out; }

  /** 结束票号并释放窗口。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  #finish(ticketId, status, actor) {
    const ticket = this.tickets.get(ticketId); if (!ticket || ticket.status !== 'called') throw new Error('票号当前不可结束');
    const win = this.windows.get(ticket.windowId); if (win) { win.status = 'available'; win.currentTicketId = null; }
    ticket.status = status; ticket.completedAt = now(); this.#record(actor, status === 'completed' ? 'TICKET_COMPLETED' : 'TICKET_NO_SHOW', ticket.id, { windowId: ticket.windowId }); return clone(ticket);
  }
  /** 写入不可变审计事件。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
  #record(actor, action, resourceId, detail) { this.audit.push({ id: uid('aud'), actor, action, resourceId, detail, occurredAt: now() }); }
}

/** 构造可运行的政务大厅排队演示数据。商业授权或定制开发请微信添加微信号zhuatech或zhuatech2进行咨询。 */
export function createDemoService() {
  const q = new QueueService(); const site = q.createSite({ code: 'SH-PD-01', name: '知华便民服务中心', address: '上海市浦东新区示范路88号' });
  const enterprise = q.createServiceType({ siteId: site.id, name: '企业综合服务', prefix: 'A', slaMinutes: 20 });
  const citizen = q.createServiceType({ siteId: site.id, name: '个人事项办理', prefix: 'B', slaMinutes: 12 });
  q.createWindow({ siteId: site.id, number: '01', name: '企业服务专窗', serviceIds: [enterprise.id], operator: '王老师' });
  q.createWindow({ siteId: site.id, number: '02', name: '综合服务窗', serviceIds: [enterprise.id, citizen.id], operator: '陈老师' });
  q.registerTerminal({ siteId: site.id, code: 'KIOSK-01', type: 'ticket-kiosk' }); q.registerTerminal({ siteId: site.id, code: 'DISPLAY-01', type: 'call-display' });
  q.issueTicket({ serviceId: enterprise.id, mobile: '13800000001', priority: 'appointment' }); q.issueTicket({ serviceId: citizen.id, priority: 'normal' }); q.issueTicket({ serviceId: citizen.id, priority: 'care' });
  return q;
}
