import Base from "./Base.js";

class Image extends Base {
  constructor(client, data) {
    super(client, data);
  }

  _patch(data) {
    super._patch(data);
    this.caption = data.body;
    this.message = data.message.imageMessage;
    this.reply_message = data.quoted || false;
    return this;
  }

}

export default Image;