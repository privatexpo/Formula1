const { Readable } = require("stream");

function requestFrom(event) {
  const raw = event.body
    ? event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body
    : "";
  const req = new Readable({
    read() {
      if (this._sent) return;
      this._sent = true;
      if (raw) this.push(raw);
      this.push(null);
    },
  });
  req.method = event.httpMethod || "GET";
  req.headers = {};
  for (const [name, value] of Object.entries(event.headers || {})) {
    req.headers[name.toLowerCase()] = value;
  }
  if (raw.trim().startsWith("{")) {
    try {
      req.body = JSON.parse(raw);
    } catch {
      /* le webhook relit le corps brut */
    }
  }
  return req;
}

function adapt(handler) {
  return async function netlifyHandler(event) {
    const req = requestFrom(event);
    let statusCode = 200;
    const headers = { "content-type": "application/json" };
    let body = "";
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      setHeader(name, value) {
        headers[String(name).toLowerCase()] = value;
      },
      json(data) {
        body = JSON.stringify(data ?? {});
      },
      end(data) {
        body = data == null ? "" : String(data);
      },
    };
    await handler(req, res);
    return { statusCode, headers, body };
  };
}

module.exports = { adapt };
