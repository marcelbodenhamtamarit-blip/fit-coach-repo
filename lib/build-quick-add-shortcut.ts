// Genera un archivo .shortcut (Apple Shortcuts) descargable, personalizado
// por usuario, que sustituye al Shortcut manual que había antes. Pide la
// cantidad, el tipo (gasto/ingreso) y la categoría a mano —no lee
// notificaciones ni intenta nada automático— y hace un GET a
// /api/quick-transaction con el token personal del usuario ya incrustado.
//
// Usa @joshfarrant/shortcuts-js para construir las acciones, pero el plist
// final lo armamos a mano (en vez de su buildShortcut()) para poder incluir
// WFWorkflowMinimumClientVersion / WFWorkflowMinimumClientVersionString:
// esa librería está pensada para iOS 12 y no las incluye, y sin ellas
// versiones recientes de Atajos pueden rechazar la importación.
//
// @ts-ignore: este paquete no publica tipos para el subpath "/actions" ni
// para el paquete raíz de forma que TS los resuelva de forma fiable.
import { variable, withVariables } from "@joshfarrant/shortcuts-js"
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
// @ts-ignore: sin tipos, solo expone una función que serializa un objeto a bplist binario
import createBplist from "bplist-creator"
import { TRANSACTION_CATEGORIES } from "@/lib/types"

// Reimplementación mínima del flatten interno de la librería: algunas
// acciones (por ejemplo los items de chooseFromMenu) devuelven arrays
// anidados que hay que aplanar antes de meterlos en WFWorkflowActions.
function flatten(arr: unknown[]): unknown[] {
  return arr.reduce<unknown[]>(
    (acc, val) => (Array.isArray(val) ? acc.concat(flatten(val)) : acc.concat(val)),
    [],
  )
}

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

  const template = {
    WFWorkflowClientVersion: "2302.0.2",
    WFWorkflowClientRelease: "2.2",
    WFWorkflowMinimumClientVersion: 900,
    WFWorkflowMinimumClientVersionString: "16.0",
    WFWorkflowHasShortcutInputVariables: false,
    WFWorkflowIcon: {
      WFWorkflowIconStartColor: 4274264319,
      WFWorkflowIconGlyphNumber: 59446,
    },
    WFWorkflowImportQuestions: [],
    WFWorkflowTypes: ["WatchKit", "NCWidget"],
    WFWorkflowInputContentItemClasses: [
      "WFAppStoreAppContentItem",
      "WFArticleContentItem",
      "WFContactContentItem",
      "WFDateContentItem",
      "WFEmailAddressContentItem",
      "WFGenericFileContentItem",
      "WFImageContentItem",
      "WFiTunesProductContentItem",
      "WFLocationContentItem",
      "WFDCMapsLinkContentItem",
      "WFAVAssetContentItem",
      "WFPDFContentItem",
      "WFPhoneNumberContentItem",
      "WFRichTextContentItem",
      "WFSafariWebPageContentItem",
      "WFStringContentItem",
      "WFURLContentItem",
    ],
    WFWorkflowActions: flatten(actions),
  }

  // bplist-creator tipa mal su export (a veces como string, en runtime
  // siempre Buffer): de ahí el cast.
  return createBplist(template) as unknown as Buffer
}
