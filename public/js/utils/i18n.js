import React, { createContext, useCallback, useContext, useState } from 'react';
import htm from 'htm';

const html = htm.bind(React.createElement);

const translations = {
  en: {
    appName: 'AI/BI Report Studio',
    appTagline: 'Narrative editor with embedded Databricks dashboard widgets',
    save: 'Save now',
    saving: 'Saving…',
    saved: 'Saved',
    savedAt: 'Saved {time}',
    unsaved: 'Unsaved changes',
    saveError: 'Save error',
    ready: 'Ready',
    restoreDemo: 'Restore demo',
    widgetLibrary: 'Widget library',
    widgetLibraryDesc: 'Insert visualizations using the same embed pattern from the original dashboards.',
    addToDoc: 'Add to document',
    workflow: 'Workflow',
    workflowDesc: 'Write freely in the document and place the cursor where you want to insert a widget. Use "Insert widget" to browse dashboards or paste an embed URL.',
    autosaveNote: 'The document auto-saves every 3 seconds when changes are detected.',
    heading: 'Heading',
    section: 'Section',
    subsection: 'Subsection',
    bold: 'Bold',
    list: 'List',
    quote: 'Quote',
    divider: 'Divider',
    insertWidget: 'Insert widget',
    editorPlaceholder: 'Start writing your report. Insert dashboard widgets from the toolbar or the side panel.',
    widgetTitle: 'Widget title',
    widgetEmbedUrl: 'Widget embed URL',
    caption: 'Caption',
    heightPx: 'Height (px)',
    cancel: 'Cancel',
    insert: 'Insert widget',
    insertManual: 'Insert manually',
    browseDashboards: 'Browse dashboards',
    selectDashboard: 'Select a dashboard',
    selectWidget: 'Select a widget to embed',
    backToDashboards: 'Back to dashboards',
    loadingDashboards: 'Loading dashboards…',
    loadingWidgets: 'Loading widgets…',
    noDashboards: 'No dashboards found in this workspace.',
    noWidgets: 'No widgets found in this dashboard.',
    page: 'Page',
    widgetType: 'Type',
    embedSource: 'Embed preserving the same format as the existing dashboard',
    open: 'Open',
    edit: 'Edit',
    remove: 'Remove',
    formHint: 'Paste a Databricks dashboard embed URL: /embed/dashboardsv3/...&fullscreenWidget=...',
    invalidUrl: 'The URL must be a Databricks dashboard embed.',
    backendError: 'Could not save the document to the Node backend.',
    loadFallback: 'Loaded a local draft because the remote document does not exist yet.',
    language: 'Language',
    seedTitle: 'From Dough to Profit Margin',
    seedIntro: 'This document combines executive narrative with live widgets from the Bakehouse dashboard. You can write free text, rearrange blocks, and add visualizations directly in the report flow.',
    seedCh1Title: 'Chapter I · Geographic footprint and revenue distribution',
    seedCh1Body: 'Bakehouse operations span multiple continents. The spatial distribution of franchises reveals high-performance clusters and enables strategic expansion planning with immediate visual context.',
    seedCh2Title: 'Chapter II · Temporal dynamics and business velocity',
    seedCh2Body: 'Temporal analysis reveals the operational pulse of the franchise. Comparing daily granularity with rolling averages separates seasonal effects from structural demand shifts.',
    seedCh2Quote: 'The day-over-day indicator works as a velocity metric. Persistently above 5% usually signals demand spikes requiring immediate operational attention.',
    seedCh3Title: 'Chapter III · Store format segmentation',
    seedCh3Body: 'Store format diversity responds to distinct local conditions. Embedding these widgets within the text lets you document hypotheses, explain decisions, and keep the report ready for executive consumption.',
    seedOutro: 'Use the toolbar or the side library to insert more dashboard widgets using the exact same embed pattern from the original application.',
    orPasteManually: 'Or paste an embed URL manually',
    apiError: 'Could not connect to workspace API. You can still paste embed URLs manually.',
  },
  pt: {
    appName: 'AI/BI Report Studio',
    appTagline: 'Editor narrativo com widgets embebidos de dashboards Databricks',
    save: 'Salvar agora',
    saving: 'Salvando…',
    saved: 'Salvo',
    savedAt: 'Salvo {time}',
    unsaved: 'Alterações não salvas',
    saveError: 'Erro ao salvar',
    ready: 'Pronto',
    restoreDemo: 'Restaurar demo',
    widgetLibrary: 'Biblioteca de widgets',
    widgetLibraryDesc: 'Insira visualizações usando o mesmo padrão de embed dos dashboards originais.',
    addToDoc: 'Adicionar ao documento',
    workflow: 'Modo de trabalho',
    workflowDesc: 'Escreva livremente no documento e posicione o cursor onde deseja inserir um widget. Use "Inserir widget" para navegar nos dashboards ou colar uma URL de embed.',
    autosaveNote: 'O documento é salvo automaticamente a cada 3 segundos quando há mudanças.',
    heading: 'Título',
    section: 'Seção',
    subsection: 'Subseção',
    bold: 'Negrito',
    list: 'Lista',
    quote: 'Citação',
    divider: 'Divisor',
    insertWidget: 'Inserir widget',
    editorPlaceholder: 'Comece a escrever seu relatório. Insira widgets de dashboards pela barra de ferramentas ou painel lateral.',
    widgetTitle: 'Título do widget',
    widgetEmbedUrl: 'URL de embed do widget',
    caption: 'Legenda',
    heightPx: 'Altura (px)',
    cancel: 'Cancelar',
    insert: 'Inserir widget',
    insertManual: 'Inserir manualmente',
    browseDashboards: 'Navegar dashboards',
    selectDashboard: 'Selecione um dashboard',
    selectWidget: 'Selecione um widget para embeber',
    backToDashboards: 'Voltar aos dashboards',
    loadingDashboards: 'Carregando dashboards…',
    loadingWidgets: 'Carregando widgets…',
    noDashboards: 'Nenhum dashboard encontrado neste workspace.',
    noWidgets: 'Nenhum widget encontrado neste dashboard.',
    page: 'Página',
    widgetType: 'Tipo',
    embedSource: 'Embed preservando o mesmo formato do dashboard existente',
    open: 'Abrir',
    edit: 'Editar',
    remove: 'Remover',
    formHint: 'Cole uma URL de embed de dashboard Databricks: /embed/dashboardsv3/...&fullscreenWidget=...',
    invalidUrl: 'A URL deve ser um embed de dashboard Databricks.',
    backendError: 'Não foi possível salvar o documento no backend Node.',
    loadFallback: 'Versão local carregada porque o documento remoto ainda não existe.',
    language: 'Idioma',
    seedTitle: 'Da Massa à Margem de Lucro',
    seedIntro: 'Este documento combina narrativa executiva com widgets vivos do dashboard Bakehouse. Você pode escrever texto livre, reorganizar blocos e adicionar visualizações diretamente no fluxo do relatório.',
    seedCh1Title: 'Capítulo I · Presença geográfica e distribuição de receita',
    seedCh1Body: 'As operações da Bakehouse se estendem por múltiplos continentes. A distribuição espacial das franquias permite detectar clusters de alto desempenho e priorizar zonas de expansão estratégica com contexto visual imediato.',
    seedCh2Title: 'Capítulo II · Dinâmica temporal e velocidade do negócio',
    seedCh2Body: 'A análise temporal revela o pulso operacional da franquia. A comparação entre granularidade diária e médias móveis permite separar efeitos sazonais de mudanças estruturais na demanda.',
    seedCh2Quote: 'O indicador day-over-day funciona como métrica de velocidade. Valores persistentemente acima de 5% costumam indicar picos de demanda que requerem atenção operacional imediata.',
    seedCh3Title: 'Capítulo III · Segmentação por formato de loja',
    seedCh3Body: 'A diversidade de formatos de loja responde a condições locais distintas. Integrar esses widgets no texto permite documentar hipóteses, explicar decisões e deixar o relatório pronto para consumo executivo.',
    seedOutro: 'Use a barra de ferramentas ou a biblioteca lateral para inserir mais widgets de dashboard usando o mesmo padrão de embed da aplicação original.',
    orPasteManually: 'Ou cole uma URL de embed manualmente',
    apiError: 'Não foi possível conectar à API do workspace. Você ainda pode colar URLs de embed manualmente.',
  },
  es: {
    appName: 'AI/BI Report Studio',
    appTagline: 'Editor narrativo con widgets embebidos de dashboards Databricks',
    save: 'Guardar ahora',
    saving: 'Guardando…',
    saved: 'Guardado',
    savedAt: 'Guardado {time}',
    unsaved: 'Cambios sin guardar',
    saveError: 'Error al guardar',
    ready: 'Listo',
    restoreDemo: 'Restaurar demo',
    widgetLibrary: 'Biblioteca de widgets',
    widgetLibraryDesc: 'Inserta visualizaciones usando el mismo patrón de embed de los dashboards originales.',
    addToDoc: 'Añadir al documento',
    workflow: 'Modo de trabajo',
    workflowDesc: 'Escribe libremente en el documento y coloca el cursor donde quieras insertar un widget. Usa "Insertar widget" para navegar dashboards o pegar una URL de embed.',
    autosaveNote: 'El documento se guarda automáticamente cada 3 segundos cuando detecta cambios.',
    heading: 'Título',
    section: 'Sección',
    subsection: 'Subsección',
    bold: 'Negrita',
    list: 'Lista',
    quote: 'Cita',
    divider: 'Divisor',
    insertWidget: 'Insertar widget',
    editorPlaceholder: 'Comienza a escribir tu reporte. Inserta widgets de dashboards desde la barra o el panel lateral.',
    widgetTitle: 'Título del widget',
    widgetEmbedUrl: 'URL de embed del widget',
    caption: 'Pie de gráfico',
    heightPx: 'Altura (px)',
    cancel: 'Cancelar',
    insert: 'Insertar widget',
    insertManual: 'Insertar manualmente',
    browseDashboards: 'Navegar dashboards',
    selectDashboard: 'Selecciona un dashboard',
    selectWidget: 'Selecciona un widget para embeber',
    backToDashboards: 'Volver a dashboards',
    loadingDashboards: 'Cargando dashboards…',
    loadingWidgets: 'Cargando widgets…',
    noDashboards: 'No se encontraron dashboards en este workspace.',
    noWidgets: 'No se encontraron widgets en este dashboard.',
    page: 'Página',
    widgetType: 'Tipo',
    embedSource: 'Embed conservando el mismo formato del dashboard existente',
    open: 'Abrir',
    edit: 'Editar',
    remove: 'Quitar',
    formHint: 'Pega una URL de embed de dashboard Databricks: /embed/dashboardsv3/...&fullscreenWidget=...',
    invalidUrl: 'La URL debe ser un embed de dashboard Databricks.',
    backendError: 'No se pudo guardar el documento en el backend Node.',
    loadFallback: 'Se cargó una versión local inicial porque el documento remoto aún no existe.',
    language: 'Idioma',
    seedTitle: 'De la Masa al Margen de Ganancia',
    seedIntro: 'Este documento combina narrativa ejecutiva con widgets vivos del dashboard de Bakehouse. Puedes escribir texto libre, reorganizar bloques y añadir visualizaciones directamente en el flujo del reporte.',
    seedCh1Title: 'Capítulo I · Huella geográfica y distribución de ingresos',
    seedCh1Body: 'La operación de Bakehouse se extiende a través de múltiples continentes. La distribución espacial de las franquicias permite detectar focos de alto rendimiento y priorizar zonas de expansión estratégica con contexto visual inmediato.',
    seedCh2Title: 'Capítulo II · Dinámica temporal y velocidad del negocio',
    seedCh2Body: 'El análisis temporal revela el pulso operativo de la franquicia. La comparación entre granularidad diaria y promedios rodantes permite separar efectos estacionales de cambios estructurales en la demanda.',
    seedCh2Quote: 'El indicador day-over-day funciona como una métrica de velocidad. Valores persistentemente superiores al 5% suelen indicar picos de demanda que requieren atención operativa inmediata.',
    seedCh3Title: 'Capítulo III · Segmentación por formato de tienda',
    seedCh3Body: 'La diversidad de formatos de tienda responde a condiciones locales distintas. Integrar estos widgets dentro del texto permite documentar hipótesis, explicar decisiones y dejar el reporte listo para consumo ejecutivo.',
    seedOutro: 'Usa la barra superior o la biblioteca lateral para insertar más widgets del dashboard con exactamente el mismo patrón de embed que ya existe en la aplicación.',
    orPasteManually: 'O pega una URL de embed manualmente',
    apiError: 'No se pudo conectar a la API del workspace. Aún puedes pegar URLs de embed manualmente.',
  },
};

const STORAGE_KEY = 'aibi-report-studio-lang';

function getInitialLocale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && translations[stored]) return stored;
  } catch (_) { /* ignore */ }
  const nav = (navigator.language || '').slice(0, 2).toLowerCase();
  if (translations[nav]) return nav;
  return 'en';
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(getInitialLocale);

  const setLocale = useCallback(next => {
    if (!translations[next]) return;
    setLocaleState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch (_) { /* ignore */ }
  }, []);

  const t = useCallback((key, params) => {
    let text = translations[locale]?.[key] || translations.en[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
    }
    return text;
  }, [locale]);

  return html`<${I18nContext.Provider} value=${{ t, locale, setLocale, locales: Object.keys(translations) }}>${children}<//>`;
}

export function useI18n() {
  return useContext(I18nContext);
}
