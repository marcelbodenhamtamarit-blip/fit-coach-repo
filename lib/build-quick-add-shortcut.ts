// Genera un archivo .shortcut (Apple Shortcuts) descargable, personalizado
// por usuario, que sustituye al Shortcut manual que había antes. Pide la
// cantidad, el tipo (gasto/ingreso) y la categoría a mano —no lee
// notificaciones ni intenta nada automático— y hace un GET a
// /api/quick-transaction con el token personal del usuario ya incrustado.
//
// Usa @joshfarrant/shortcuts-js para construir el plist binario real que
// espera la app Atajos de iOS. El shortcut resultante lleva "WatchKit" en
// WFWorkflowTypes, así que en principio ya está habilitado para el Apple
// Watch sin pasos extra (aunque en algunos iOS hace falta confirmarlo a
// mano: Atajos -> el atajo -> ⓘ -> "Mostrar en Apple Watch").
//
// @ts-ignore: este paquete no publica tipos para el subpath "/actions" ni
// para el paquete raíz de forma que TS los resuelva de forma fiable.
import { buildShortcut, variable, withVariables } from "@joshfarrant/shortcuts-js"
// @ts-ignore
import {
  ask,
  chooseFromMenu,
  getContentsOfURL,
  setVariable,
  showNotification,
  text,
  URL as urlAction,
  URLEncode,
} from "@joshfarrant/shortcuts-js/actions"
import { TRANSACTION_CATEGORIES } from "@/lib/types"

export function buildQuickAddShortcut({ baseUrl, token }: { baseUrl: string; token: string }): Buffer {
  const amountVar = variable("ZentOS Cantidad")
  const typeVar = variable("ZentOS Tipo")
  const categoryVar = variable("ZentOS Categoria")
  const categoryEncodedVar = variable("ZentOS CategoriaCodificada")

  // Importante: baseUrl y token son literales conocidos al generar el
  // archivo (no variables del propio Shortcut), así que van en los trozos
  // de texto fijo de withVariables, nunca dentro de un `${}` -esos solo
  // aceptan objetos Variable, si no la generación del plist revienta.
  const urlPrefix = `${baseUrl}/api/quick-transaction?token=${token}&amount=`
  const urlValue = withVariables(
    [urlPrefix, "&type=", "&category=", ""] as unknown as TemplateStringsArray,
    amountVar,
    typeVar,
    categoryEncodedVar,
  )

  const actions = [
    ask({ inputType: "Number", question: "¿Cuánto? (AUD)" }),
    setVariable({ variable: amountVar }),

    chooseFromMenu({
      prompt: "¿Gasto o ingreso?",
      items: [
        { label: "Gasto", actions: [text({ text: "gasto" }), setVariable({ variable: typeVar })] },
        { label: "Ingreso", actions: [text({ text: "ingreso" }), setVariable({ variable: typeVar })] },
      ],
    }),

    chooseFromMenu({
      prompt: "Categoría",
      items: TRANSACTION_CATEGORIES.map((c) => ({
        label: c,
        actions: [text({ text: c }), setVariable({ variable: categoryVar })],
      })),
    }),

    text({ text: withVariables`${categoryVar}` }),
    URLEncode({ encodeMode: "Encode" }),
    setVariable({ variable: categoryEncodedVar }),

    urlAction({ url: urlValue }),
    getContentsOfURL({ method: "GET" }),

    showNotification({
      title: "ZentOS",
      body: "Movimiento guardado ✅",
      sound: true,
    }),
  ]

  // El paquete tipa buildShortcut como si devolviera un string, pero en
  // runtime devuelve el Buffer que produce bplist-creator.
  return buildShortcut(actions, { showInWidget: true }) as unknown as Buffer
}
