
const ipRequests = new Map<string, { count: number, resetTime: number }>();

export async function checkRateLimit(ip: string, limit: number = 2000, windowMs: number = 10 * 60 * 1000) {
    const now = Date.now();
    const record = ipRequests.get(ip) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
        record.count = 0;
        record.resetTime = now + windowMs;
    }

    record.count++;
    ipRequests.set(ip, record);

    if (record.count > limit) {
        return false;
    }
    return true;
}
