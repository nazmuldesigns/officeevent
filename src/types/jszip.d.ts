declare module "jszip" {
  export default class JSZip {
    file(name: string, data: string | Blob | ArrayBuffer | Uint8Array): this;
    generateAsync(options: {
      type: "blob" | "uint8array" | "arraybuffer" | "base64";
      compression?: "STORE" | "DEFLATE";
    }): Promise<Blob>;
  }
}
