declare module "heic-convert" {
  export type ConvertOptions = {
    buffer: Buffer | Uint8Array | ArrayBuffer;
    format: "JPEG" | "PNG";
    quality?: number;
  };

  export default function convert(options: ConvertOptions): Promise<Uint8Array | ArrayBuffer>;
}
