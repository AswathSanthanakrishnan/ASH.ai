import { api } from "encore.dev/api";

export const page = api.raw(
  { expose: true, method: "GET", path: "/" },
  async (_request, response) => {
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(html);
  },
);

const html = /* html */ `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ash — Dev Chat</title>
  <style>
    :root { color-scheme: dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #101113; color: #e9e9ed; }
    * { box-sizing: border-box; }
    body { margin: 0; }
    main { max-width: 840px; height: 100vh; height: 100dvh; margin: auto; display: flex; flex-direction: column; }
    header { padding: 24px; border-bottom: 1px solid #292b30; display: flex; align-items: center; justify-content: space-between; }
    h1 { margin: 0; font-size: 22px; letter-spacing: -0.7px; }
    .badge { font-size: 11px; color: #adaeb8; border: 1px solid #35373f; border-radius: 6px; padding: 5px 8px; letter-spacing: 1px; text-transform: uppercase; }
    #history { flex: 1; min-height: 0; overflow-y: auto; padding: 28px 24px; }
    #welcome { margin: 12vh auto 0; max-width: 360px; text-align: center; }
    h2 { font-size: 26px; letter-spacing: -0.8px; font-weight: 500; }
    #welcome p, .note { color: #9597a3; font-size: 13px; line-height: 1.7; }
    .message { margin: 0 0 24px; max-width: 90%; }
    .message.user { margin-left: auto; width: fit-content; }
    .author { font-size: 11px; font-weight: 600; color: #a9abb6; margin-bottom: 8px; }
    .user .author { text-align: right; }
    .content { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 15px; line-height: 1.7; }
    .user .content { background: #25272e; border: 1px solid #32353e; border-radius: 16px 16px 4px 16px; padding: 12px 16px; }
    footer { padding: 12px 24px 20px; }
    #status { min-height: 24px; margin: 0 0 8px; color: #aeb2c6; font-size: 13px; }
    #status.error { color: #ffadb0; }
    form { display: flex; gap: 10px; background: #1c1e23; border: 1px solid #393c46; padding: 8px; border-radius: 14px; }
    input { flex: 1; min-width: 0; background: transparent; color: inherit; border: 0; padding: 10px; font: inherit; font-size: 16px; }
    input::placeholder { color: #8e919e; }
    input:focus { outline: none; }
    form:focus-within { border-color: #a6b3fa; }
    button { border: 0; border-radius: 9px; padding: 10px 18px; font: inherit; font-size: 14px; font-weight: 600; background: #c1cbff; color: #191d30; cursor: pointer; }
    button:hover { background: #d3daff; }
    button:focus-visible { outline: 2px solid white; outline-offset: 3px; }
    button:disabled { opacity: 0.4; cursor: default; }
    .note { margin: 10px 0 0; text-align: center; font-size: 11px; }
    @media (max-width: 480px) { header { padding: 18px; } #history { padding: 24px 16px; } footer { padding: 10px 16px 16px; } }
  </style>
</head>
<body>
  <main>
    <header><h1>Ash<span style="color:#a6b3fa">.</span></h1><span class="badge">Dev chat</span></header>
    <section id="history" role="log" aria-label="Conversation" aria-live="polite">
      <div id="welcome"><h2>What’s on your mind?</h2><p>Ask a question, look something up, or pick up where you left off.</p></div>
    </section>
    <footer>
      <p id="status" role="status" aria-live="polite"></p>
      <form id="chat-form">
        <input id="message" aria-label="Message Ash" placeholder="Message Ash…" autocomplete="off" required autofocus>
        <button id="send" type="submit" disabled>Send</button>
      </form>
      <p class="note">Temporary dev page · This view resets on reload; Ash keeps saved conversation memory.</p>
    </footer>
  </main>
  <script>
    const form = document.getElementById('chat-form');
    const input = document.getElementById('message');
    const send = document.getElementById('send');
    const history = document.getElementById('history');
    const status = document.getElementById('status');
    let pending = false;

    function addMessage(role, text) {
      document.getElementById('welcome')?.remove();
      const message = document.createElement('article');
      message.className = 'message ' + role;
      const author = document.createElement('div');
      author.className = 'author';
      author.textContent = role === 'user' ? 'You' : 'Ash';
      const content = document.createElement('div');
      content.className = 'content';
      // Treat user and model text as text, never executable HTML.
      content.textContent = text;
      message.append(author, content);
      history.append(message);
      history.scrollTop = history.scrollHeight;
    }

    input.addEventListener('input', () => { send.disabled = pending || !input.value.trim(); });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = input.value.trim();
      if (pending || !message) return;
      pending = true;
      send.disabled = true;
      input.disabled = true;
      input.value = '';
      addMessage('user', message);
      status.className = '';
      status.textContent = 'Ash is thinking…';
      try {
        const response = await fetch('/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
        });
        if (!response.ok) throw new Error('Request failed (' + response.status + '). Please try again.');
        const data = await response.json();
        if (typeof data.reply !== 'string') throw new Error('Ash returned an unexpected response. Please try again.');
        addMessage('assistant', data.reply);
        status.textContent = '';
      } catch (error) {
        status.className = 'error';
        status.textContent = error instanceof Error ? error.message : 'Could not reach Ash. Please try again.';
        input.value = message;
      } finally {
        pending = false;
        input.disabled = false;
        send.disabled = !input.value.trim();
        input.focus();
      }
    });
  </script>
</body>
</html>`;
