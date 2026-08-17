import type { MetadataRoute } from "next"

// Next detecta este archivo solo y sirve /manifest.webmanifest, sin tocar
// layout.tsx. Con esto la app se puede instalar en el móvil (Android: banner
// de instalar / icono con accesos directos al mantener pulsado; iPhone:
// Safari -> Compartir -> Añadir a pantalla de inicio, usando estos mismos
// datos para el nombre e icono).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZentOS",
    short_name: "ZentOS",
    description: "Control de economía personal, por usuario.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0d0f",
    theme_color: "#0d0d0f",
    icons: [
      {
        src: "/icon-dark-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
    // Solo tiene efecto en Android/Chrome (mantener pulsado el icono).
    // En iPhone, la vía real es instalar /quick-add como su propio icono
    // aparte (ver instrucciones).
    shortcuts: [
      {
        name: "Añadir gasto",
        short_name: "Añadir",
        url: "/quick-add",
        description: "Registrar un gasto o ingreso rápido",
      },
    ],
  }
}
