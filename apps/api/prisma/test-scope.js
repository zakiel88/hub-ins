const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();
function decrypt(e, iv) {
    const key = Buffer.from(process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
    const d = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
    return d.update(e, 'hex', 'utf8') + d.final('utf8');
}
(async () => {
    const store = await prisma.shopifyStore.findFirst({ where: { isActive: true } });
    const token = decrypt(store.accessTokenEnc, store.tokenIv);
    console.log('Scopes:', store.scopes);
    const r1 = await fetch('https://' + store.shopifyDomain + '/admin/api/' + store.apiVersion + '/shop.json', {
        headers: { 'X-Shopify-Access-Token': token }
    });
    console.log('shop.json:', r1.status);
    const r2 = await fetch('https://' + store.shopifyDomain + '/admin/api/' + store.apiVersion + '/orders.json?limit=1&status=any', {
        headers: { 'X-Shopify-Access-Token': token }
    });
    console.log('orders.json:', r2.status);
    if (r2.status !== 200) console.log(await r2.text());
    else {
        const d = await r2.json();
        console.log('Orders count:', d.orders?.length);
    }
    await prisma['$disconnect']();
})();
