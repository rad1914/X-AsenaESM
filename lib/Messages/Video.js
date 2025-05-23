import Base from "./Base.js";

class Video extends Base {
  constructor(client, data) {
    super(client, data);
  }

  _patch(data) {
    super._patch(data);
    this.caption = data.body;
    this.message = data.message.videoMessage;
    this.reply_message = data.quoted || false;
    return this;
  }
}

export default Video;