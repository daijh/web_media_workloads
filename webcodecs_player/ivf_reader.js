'use strict';

class IVFReader {
  constructor(init) {
    //console.log(init.file);

    this.file = init.file;
    this.callback = init.callback;

    this.fourcc = "";
    this.codec = undefined;
    this.frame_rate = 0;
    this.offset = 0;
    this.all_frames = 0;
    this.num_of_frames = 0;

    this.file_reader = new FileReader();
    this.file_reader.onerror = this.onerror.bind(this);
    //this.file_reader.onprogress = this.onprogress.bind(this);
    this.file_reader.onload = this.onload.bind(this);

    // var blob = file.slice(_offset, length + _offset);
    // reader.readAsArrayBuffer(blob);
    this.file_reader.readAsArrayBuffer(this.file);
  }

  onerror() {
    console.log("onerror", this.file);
    this.callback("error, read input file");
    //reject(new DOMException("Problem read input file", this.file));
  }

  onprogress(event) {
    console.log("onprogress", event);
  }

  onload() {
    //console.log("onload", this.file);

    this.ReadHeader();
  }

  ReadHeader() {
    if (this.file_reader.result.length <= 32) {
      this.callback("error, invalid file size " + this.file_reader.result.byteLength.toString());
      return;
    }

    const view = new DataView(this.file_reader.result.slice(0, 32));

    if (String.fromCharCode(view.getUint8(0)) != 'D' ||
      String.fromCharCode(view.getUint8(1)) != 'K' ||
      String.fromCharCode(view.getUint8(2)) != 'I' ||
      String.fromCharCode(view.getUint8(3)) != 'F') {
      console.log("invalid ivf signature", String.fromCharCode(view.getUint8(0)),
        String.fromCharCode(view.getUint8(1)),
        String.fromCharCode(view.getUint8(2)),
        String.fromCharCode(view.getUint8(3)));

      this.callback("error, invalid ivf signature");
      return;
    }

    this.fourcc = String.fromCharCode(view.getUint8(8)) +
      String.fromCharCode(view.getUint8(9)) +
      String.fromCharCode(view.getUint8(10)) +
      String.fromCharCode(view.getUint8(11));

    switch (this.fourcc) {
      case "VP80":
        this.codec = "vp8";
        break;

      case "VP90":
        this.codec = "vp09.00.10.8";
        break;

      case "AV01":
        this.codec = "av01.0.00M.08";
        break

      default:
        this.callback("error, unkonwn fourcc" + this.fourcc);
        return;
    }

    //this.frame_rate = view.getUint32(16, true) / view.getUint32(20, true);
    this.frame_rate = 30;
    this.all_frames = view.getUint32(24, true);

    console.log(this.fourcc,
      ",", view.getUint16(12, true), "x", view.getUint16(14, true),
      ", fps", this.frame_rate,
      ", frames", this.all_frames);

    this.offset = 32;
  }

  GetInfo() {
    return { codec: this.codec };
  }

  Reset() {
    this.num_of_frames = 0;
    this.offset = 32;
  }

  ReadFrame() {
    if (this.offset + 12 >= this.file_reader.result.byteLength) {
      this.callback("eos, " + this.num_of_frames.toString() + " in " + this.all_frames.toString() + " frames");
      return;
    }

    const view = new DataView(this.file_reader.result.slice(this.offset, this.offset + 12));
    const frame_offset = this.offset + 12;
    const frame_size = view.getUint32(0, true);
    //const timestamp = view.getBigUint64(4, true);
    const timestamp = 1000.0 * 1000.0 / this.frame_rate * view.getUint32(4, true);

    this.num_of_frames++;
    this.offset += 12 + frame_size;

    return { data: this.file_reader.result.slice(frame_offset, frame_offset + frame_size), timestamp: timestamp };
  }
}