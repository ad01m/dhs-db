import tls from 'node:tls';

const clean = (value) => String(value || '').replace(/[\r\n]/g, ' ').trim();

function replyReader(socket) {
  let buffer = '';
  const waiters = [];
  socket.setEncoding('utf8');
  socket.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (/^\d{3} /.test(line)) waiters.shift()?.resolve(line);
    }
  });
  socket.on('error', (error) => {
    while (waiters.length) waiters.shift().reject(error);
  });
  return () => new Promise((resolve, reject) => waiters.push({ resolve, reject }));
}

export async function sendContactEmail({ name, email, phone, message, to }) {
  const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD } = process.env;
  const recipient = to || process.env.SMTP_TO;
  const port = Number(process.env.SMTP_PORT || 465);
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !recipient) {
    throw new Error('Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD, then add the school contact email in Admin Settings.');
  }
  if (port !== 465) throw new Error('Use SMTP port 465 with implicit TLS.');

  const socket = tls.connect({ host: SMTP_HOST, port, servername: SMTP_HOST });
  socket.setTimeout(20000, () => socket.destroy(new Error('SMTP connection timed out.')));
  const nextReply = replyReader(socket);
  const expect = async (codes) => {
    const line = await nextReply();
    if (!codes.includes(Number(line.slice(0, 3)))) throw new Error(`SMTP server rejected request (${line}).`);
  };
  const command = async (text, codes) => {
    const response = expect(codes);
    socket.write(`${text}\r\n`);
    await response;
  };

  try {
    const greeting = expect([220]);
    await new Promise((resolve, reject) => {
      socket.once('secureConnect', resolve);
      socket.once('error', reject);
    });
    await greeting;
    await command(`EHLO ${clean(process.env.SMTP_HELO || 'school-website')}`, [250]);
    await command('AUTH LOGIN', [334]);
    await command(Buffer.from(SMTP_USER).toString('base64'), [334]);
    await command(Buffer.from(SMTP_PASSWORD).toString('base64'), [235]);
    await command(`MAIL FROM:<${clean(SMTP_USER)}>`, [250]);
    await command(`RCPT TO:<${clean(recipient)}>`, [250, 251]);
    await command('DATA', [354]);

    const subject = Buffer.from('School website contact message', 'utf8').toString('base64');
    const body = [`Name: ${clean(name)}`, `Email: ${clean(email) || 'Not provided'}`, `Phone: ${clean(phone)}`, '', String(message).replace(/\r/g, '')].join('\n');
    const encodedBody = Buffer.from(body, 'utf8').toString('base64').match(/.{1,76}/g)?.join('\r\n') || '';
    const messageData = [
      `From: ${clean(SMTP_USER)}`,
      `To: ${clean(recipient)}`,
      `Reply-To: ${email ? clean(email) : clean(SMTP_USER)}`,
      `Subject: =?UTF-8?B?${subject}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      encodedBody,
      '.',
      '',
    ].join('\r\n');
    const delivery = expect([250]);
    socket.write(messageData);
    await delivery;
    await command('QUIT', [221]);
  } finally {
    socket.end();
  }
}
