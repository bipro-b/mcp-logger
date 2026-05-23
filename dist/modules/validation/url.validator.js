"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSsrfUrl = void 0;
function isSsrfUrl(urlStr) {
    let hostname;
    try {
        hostname = new URL(urlStr).hostname.replace(/^\[|\]$/g, "");
    }
    catch {
        return true;
    }
    const lower = hostname.toLowerCase();
    if (["localhost", "metadata.google.internal"].includes(lower))
        return true;
    const ipv4 = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
        const [a, b] = [parseInt(ipv4[1]), parseInt(ipv4[2])];
        if (a === 0 || a === 127)
            return true;
        if (a === 10)
            return true;
        if (a === 172 && b >= 16 && b <= 31)
            return true;
        if (a === 192 && b === 168)
            return true;
        if (a === 169 && b === 254)
            return true;
    }
    if (hostname === "::1")
        return true;
    return false;
}
exports.isSsrfUrl = isSsrfUrl;
