/**
 * Herramientas de Google Drive para Gemini Pro
 * Implementa operaciones de creación de documentos (Google Docs, Sheets, Slides)
 *
 * ⚠️ IMPORTANTE:
 * Usa el scope 'drive.file' (no sensible) que solo permite acceso a archivos
 * creados por esta aplicación, NO a todos los archivos del usuario.
 */

import { google } from 'googleapis';
import { Auth } from 'googleapis';
import { generateQuotaUser, callGoogleApiSafely } from './utils/quotaUser';

/**
 * Crea un nuevo archivo de Google (Doc, Sheet o Slide)
 * ⚠️ Requiere scope: drive.file
 */
export async function createDocument(
  authClient: Auth.OAuth2Client,
  userId: string,
  params: {
    title: string;
    type: 'doc' | 'sheet' | 'slide'; // Tipo de documento
  }
): Promise<any> {
  const drive = google.drive({ version: 'v3', auth: authClient });
  const quotaUser = generateQuotaUser(userId);

  try {
    // Determinar el mimeType según el tipo
    let mimeType: string;
    let typeName: string;

    switch (params.type) {
      case 'doc':
        mimeType = 'application/vnd.google-apps.document';
        typeName = 'Google Doc';
        break;
      case 'sheet':
        mimeType = 'application/vnd.google-apps.spreadsheet';
        typeName = 'Google Sheet';
        break;
      case 'slide':
        mimeType = 'application/vnd.google-apps.presentation';
        typeName = 'Google Slide';
        break;
      default:
        return {
          status: 'error',
          message: `Tipo de documento inválido: "${params.type}". Usa "doc", "sheet" o "slide".`,
        };
    }

    console.log(`[DRIVE] Creando ${typeName}: "${params.title}"`);

    // Crear el archivo
    const response = await callGoogleApiSafely(
      'drive.files.create',
      () => drive.files.create({
        requestBody: {
          name: params.title,
          mimeType: mimeType,
        },
        fields: 'id, name, mimeType, webViewLink, createdTime',
        quotaUser: quotaUser,
      }),
      userId
    );

    return {
      status: 'success',
      message: `${typeName} "${params.title}" creado exitosamente.`,
      document: {
        id: response.data.id,
        name: response.data.name,
        type: params.type,
        webViewLink: response.data.webViewLink,
        createdTime: response.data.createdTime,
      },
    };

  } catch (error: any) {
    console.error('[DRIVE] Error creando documento:', error.message);

    let errorMsg = error.message;
    if (error.code === 403) {
      errorMsg = 'No tienes permisos para crear archivos en Drive. Verifica los scopes de OAuth.';
    }

    return {
      status: 'error',
      message: `Error al crear el documento: ${errorMsg}`,
    };
  }
}

/**
 * Lista archivos de Google Drive creados por esta aplicación
 * ⚠️ Requiere scope: drive.file
 * Nota: Con drive.file solo se ven archivos creados por la app
 */
export async function listMyDocuments(
  authClient: Auth.OAuth2Client,
  userId: string,
  params?: {
    maxResults?: number;
  }
): Promise<any> {
  const drive = google.drive({ version: 'v3', auth: authClient });
  const quotaUser = generateQuotaUser(userId);

  try {
    console.log('[DRIVE] Listando documentos creados por la aplicación');

    const response = await callGoogleApiSafely(
      'drive.files.list',
      () => drive.files.list({
        pageSize: params?.maxResults || 20,
        fields: 'files(id, name, mimeType, webViewLink, createdTime, modifiedTime)',
        orderBy: 'modifiedTime desc',
        q: "trashed = false and mimeType contains 'google-apps'", // Solo archivos de Google (no carpetas)
        quotaUser: quotaUser,
      }),
      userId
    );

    const files = response.data.files || [];

    if (files.length === 0) {
      return {
        status: 'success',
        message: 'No has creado ningún documento con esta aplicación.',
        documents: [],
        count: 0,
      };
    }

    // Formatear archivos
    const formattedDocs = files.map((file: any) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      webViewLink: file.webViewLink,
      createdTime: file.createdTime,
      modifiedTime: file.modifiedTime,
    }));

    return {
      status: 'success',
      message: `Se encontraron ${files.length} documentos.`,
      documents: formattedDocs,
      count: files.length,
    };

  } catch (error: any) {
    console.error('[DRIVE] Error listando documentos:', error.message);

    let errorMsg = error.message;
    if (error.code === 403) {
      errorMsg = 'No tienes permisos para acceder a Drive.';
    }

    return {
      status: 'error',
      message: `Error al listar documentos: ${errorMsg}`,
    };
  }
}

/**
 * Elimina un archivo de Google Drive
 * ⚠️ Requiere scope: drive.file
 * Nota: Solo puede eliminar archivos creados por esta app
 */
export async function deleteDocument(
  authClient: Auth.OAuth2Client,
  userId: string,
  params: {
    file_id: string;
  }
): Promise<any> {
  const drive = google.drive({ version: 'v3', auth: authClient });
  const quotaUser = generateQuotaUser(userId);

  try {
    console.log(`[DRIVE] Eliminando archivo con ID: ${params.file_id}`);

    await callGoogleApiSafely(
      'drive.files.delete',
      () => drive.files.delete({
        fileId: params.file_id,
        quotaUser: quotaUser,
      }),
      userId
    );

    return {
      status: 'success',
      message: 'Documento eliminado exitosamente.',
    };

  } catch (error: any) {
    console.error('[DRIVE] Error eliminando documento:', error.message);

    let errorMsg = error.message;
    if (error.code === 404) {
      errorMsg = 'No se encontró el documento con ese ID o no tienes acceso a él.';
    } else if (error.code === 403) {
      errorMsg = 'No tienes permisos para eliminar este archivo.';
    }

    return {
      status: 'error',
      message: `Error al eliminar el documento: ${errorMsg}`,
    };
  }
}
