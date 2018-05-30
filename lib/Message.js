'use strict';

class Message {
  constructor(body) {
    this.body = body;
  }

  getStringBufferBody() {
    if (typeof this.body === 'object') {
      this.body = JSON.stringify(this.body);
    }
    return new Buffer(this.body);
  }

}

module.exports = Message;
