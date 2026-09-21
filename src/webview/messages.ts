import { SemanticModel, SourceRange } from '../parser/types';
import { PositionedScene } from '../layout/types';

/**
 * Host to Webview messages
 */
export type HostToWebviewMessage =
  | { type: 'updateModel'; model: SemanticModel; scene: PositionedScene; symbolsSvg: string; theme: 'vscode' | 'studio' }
  | { type: 'selectNode'; nodeId: string; range: SourceRange }
  | { type: 'setTheme'; theme: 'vscode' | 'studio' }
  | { type: 'showWarning'; message: string };

/**
 * Webview to Host messages
 */
export type WebviewToHostMessage =
  | { type: 'ready' }
  | { type: 'revealXml'; range: SourceRange; focusEditor?: boolean }
  | { type: 'navigateFlowRef'; flowName: string }
  | { type: 'toggleCollapse'; nodeId: string }
  | { type: 'exportScene'; format: 'svg' | 'png' };
