export type ThirdPartyLicense = Readonly<{
  name: string;
  version: string;
  license: string;
  sourceUrl: string;
}>;

export const thirdPartyLicenses = [
  {
    name: "@tailwindcss/vite",
    version: "4.2.4",
    license: "MIT",
    sourceUrl: "https://github.com/tailwindlabs/tailwindcss",
  },
  {
    name: "@tauri-apps/api",
    version: "2.11.0",
    license: "Apache-2.0 OR MIT",
    sourceUrl: "https://github.com/tauri-apps/tauri",
  },
  {
    name: "@tauri-apps/plugin-dialog",
    version: "2.7.0",
    license: "MIT OR Apache-2.0",
    sourceUrl: "https://github.com/tauri-apps/plugins-workspace",
  },
  {
    name: "@tauri-apps/plugin-opener",
    version: "2.5.3",
    license: "MIT OR Apache-2.0",
    sourceUrl: "https://github.com/tauri-apps/plugins-workspace",
  },
  {
    name: "lucide-react",
    version: "1.14.0",
    license: "ISC",
    sourceUrl: "https://github.com/lucide-icons/lucide",
  },
  {
    name: "react",
    version: "19.2.5",
    license: "MIT",
    sourceUrl: "https://github.com/facebook/react",
  },
  {
    name: "react-dom",
    version: "19.2.5",
    license: "MIT",
    sourceUrl: "https://github.com/facebook/react",
  },
  {
    name: "react-markdown",
    version: "10.1.0",
    license: "MIT",
    sourceUrl: "https://github.com/remarkjs/react-markdown",
  },
  {
    name: "remark-gfm",
    version: "4.0.1",
    license: "MIT",
    sourceUrl: "https://github.com/remarkjs/remark-gfm",
  },
  {
    name: "tailwindcss",
    version: "4.2.4",
    license: "MIT",
    sourceUrl: "https://github.com/tailwindlabs/tailwindcss",
  },
] as const satisfies readonly ThirdPartyLicense[];
