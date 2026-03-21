type SendFn = (data: string) => void;
const clients = new Set<SendFn>();
const MAX_CLIENTS = 500;

export function broadcastEvent(event: object) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  clients.forEach(send => {
    try { send(data); } catch { clients.delete(send); }
  });
}

export function addClient(send: SendFn) {
  if (clients.size >= MAX_CLIENTS) {
    // 가장 오래된 클라이언트(Set은 insertion order 보장) 제거
    const oldest = clients.values().next().value as SendFn | undefined;
    if (oldest) clients.delete(oldest);
  }
  clients.add(send);
}
export function removeClient(send: SendFn) { clients.delete(send); }
