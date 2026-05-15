/**
 * Model listing types for the /v1/models endpoint.
 */

/** Public model info returned by GET /v1/models */
export interface ModelInfo {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
  supported_voices: string[];
}
