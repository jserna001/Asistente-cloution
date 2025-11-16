import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { google, gmail_v1 } from 'googleapis';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { decryptToken } from './tokenService';
import { EmailParser } from './emailParser';

/**
 * Resultado de una sincronización de Gmail
 */
export interface GmailSyncResult {
  success: boolean;
  emailsProcessed: number;
  emailsSkipped: number;
  newHistoryId?: string;
  error?: string;
  isFirstSync: boolean;
  duration: number; // en milisegundos
}

/**
 * Configuración de sincronización
 */
interface SyncConfig {
  maxEmailsPerSync: number;
  initialSyncDays: number;
  excludedLabels: string[];
  includedLabels: string[] | null;
  excludePromotions: boolean;
  excludeSocial: boolean;
  processAttachmentsNames: boolean;
  maxEmailContentLength: number;
}

/**
 * Servicio centralizado para sincronización de Gmail
 */
export class GmailSyncService {
  private supabase: SupabaseClient;
  private genAI: GoogleGenerativeAI;

  constructor(supabaseUrl: string, supabaseServiceKey: string, geminiApiKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.genAI = new GoogleGenerativeAI(geminiApiKey);
  }

  /**
   * Sincroniza emails para un usuario específico
   */
  async syncUserGmail(userId: string, forceFullSync: boolean = false): Promise<GmailSyncResult> {
    const startTime = Date.now();
    console.log(`[GmailSync] Iniciando sincronización para usuario ${userId}`);

    try {
      // 1. Obtener configuración del usuario
      const config = await this.getUserConfig(userId);

      // 2. Obtener y configurar credenciales de Google
      const gmail = await this.getGmailClient(userId);

      // 3. Obtener estado de sincronización
      const syncStatus = await this.getSyncStatus(userId);

      // 4. Determinar si es primera sincronización
      const isFirstSync = !syncStatus?.last_sync_token || forceFullSync;

      // 5. Ejecutar sincronización según el modo
      let result: GmailSyncResult;
      if (isFirstSync) {
        result = await this.performInitialSync(userId, gmail, config);
      } else {
        result = await this.performIncrementalSync(userId, gmail, config, syncStatus.last_sync_token);
      }

      // 6. Calcular duración
      result.duration = Date.now() - startTime;

      console.log(`[GmailSync] Sincronización completada: ${result.emailsProcessed} emails procesados en ${result.duration}ms`);

      return result;

    } catch (error: any) {
      console.error('[GmailSync] Error durante sincronización:', error);

      // Actualizar error en sync_status
      await this.updateSyncError(userId, error.message);

      return {
        success: false,
        emailsProcessed: 0,
        emailsSkipped: 0,
        error: error.message,
        isFirstSync: false,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Sincronización inicial (últimos N días)
   */
  private async performInitialSync(
    userId: string,
    gmail: gmail_v1.Gmail,
    config: SyncConfig
  ): Promise<GmailSyncResult> {
    console.log(`[GmailSync] Ejecutando sincronización INICIAL (últimos ${config.initialSyncDays} días)`);

    // Calcular fecha límite
    const afterDate = new Date();
    afterDate.setDate(afterDate.getDate() - config.initialSyncDays);
    const afterTimestamp = Math.floor(afterDate.getTime() / 1000);

    // Buscar mensajes usando messages.list con filtro de fecha
    const query = `after:${afterTimestamp}`;
    let emailsProcessed = 0;
    let emailsSkipped = 0;
    let pageToken: string | undefined;

    do {
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: Math.min(config.maxEmailsPerSync - emailsProcessed, 100),
        pageToken,
      });

      const messages = listResponse.data.messages || [];

      for (const msgRef of messages) {
        if (emailsProcessed >= config.maxEmailsPerSync) {
          console.log(`[GmailSync] Límite alcanzado: ${config.maxEmailsPerSync} emails`);
          break;
        }

        try {
          // Obtener mensaje completo
          const fullMessage = await gmail.users.messages.get({
            userId: 'me',
            id: msgRef.id!,
            format: 'full',
          });

          // Validar filtros
          if (!EmailParser.shouldProcessEmail(fullMessage.data, config)) {
            emailsSkipped++;
            continue;
          }

          // Procesar y guardar
          await this.processAndSaveEmail(userId, fullMessage.data, config);
          emailsProcessed++;

        } catch (error: any) {
          console.error(`[GmailSync] Error procesando email ${msgRef.id}:`, error.message);
          emailsSkipped++;
        }
      }

      pageToken = listResponse.data.nextPageToken || undefined;

      // Salir si alcanzamos el límite
      if (emailsProcessed >= config.maxEmailsPerSync) break;

    } while (pageToken);

    // Obtener el historyId actual para futuras sincronizaciones
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const currentHistoryId = profile.data.historyId!;

    // Actualizar sync_status
    await this.updateSyncStatus(userId, currentHistoryId, true);

    // Marcar primera sincronización como completada
    await this.markFirstSyncCompleted(userId, emailsProcessed);

    return {
      success: true,
      emailsProcessed,
      emailsSkipped,
      newHistoryId: currentHistoryId,
      isFirstSync: true,
      duration: 0, // Se calcula fuera
    };
  }

  /**
   * Sincronización incremental (usando History API)
   */
  private async performIncrementalSync(
    userId: string,
    gmail: gmail_v1.Gmail,
    config: SyncConfig,
    lastHistoryId: string
  ): Promise<GmailSyncResult> {
    console.log(`[GmailSync] Ejecutando sincronización INCREMENTAL desde historyId: ${lastHistoryId}`);

    let emailsProcessed = 0;
    let emailsSkipped = 0;

    try {
      // Obtener historial de cambios
      const historyResponse = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: lastHistoryId,
        historyTypes: ['messageAdded'],
        maxResults: config.maxEmailsPerSync,
      });

      const newHistoryId = historyResponse.data.historyId;
      if (!newHistoryId) {
        console.log('[GmailSync] No hay nuevo historyId, sincronización completa');
        return {
          success: true,
          emailsProcessed: 0,
          emailsSkipped: 0,
          isFirstSync: false,
          duration: 0,
        };
      }

      const messagesAdded = historyResponse.data.history?.flatMap(h => h.messagesAdded || []) || [];

      if (messagesAdded.length === 0) {
        console.log('[GmailSync] No hay emails nuevos');
        // Actualizar historyId de todas formas
        await this.updateSyncStatus(userId, newHistoryId, false);
        return {
          success: true,
          emailsProcessed: 0,
          emailsSkipped: 0,
          newHistoryId,
          isFirstSync: false,
          duration: 0,
        };
      }

      console.log(`[GmailSync] ${messagesAdded.length} emails nuevos encontrados`);

      // Procesar cada email nuevo
      for (const added of messagesAdded) {
        if (!added.message?.id) continue;

        try {
          // Obtener mensaje completo
          const fullMessage = await gmail.users.messages.get({
            userId: 'me',
            id: added.message.id,
            format: 'full',
          });

          // Validar filtros
          if (!EmailParser.shouldProcessEmail(fullMessage.data, config)) {
            emailsSkipped++;
            continue;
          }

          // Procesar y guardar
          await this.processAndSaveEmail(userId, fullMessage.data, config);
          emailsProcessed++;

        } catch (error: any) {
          console.error(`[GmailSync] Error procesando email ${added.message.id}:`, error.message);
          emailsSkipped++;
        }
      }

      // Actualizar sync_status con nuevo historyId
      await this.updateSyncStatus(userId, newHistoryId, false);

      return {
        success: true,
        emailsProcessed,
        emailsSkipped,
        newHistoryId,
        isFirstSync: false,
        duration: 0,
      };

    } catch (error: any) {
      // Si el historyId expiró, forzar sincronización completa
      if (error.code === 404 || error.message?.includes('history')) {
        console.log('[GmailSync] HistoryId expirado, ejecutando sincronización inicial');
        return await this.performInitialSync(userId, gmail, config);
      }
      throw error;
    }
  }

  /**
   * Procesa un email y lo guarda en document_chunks
   */
  private async processAndSaveEmail(
    userId: string,
    message: gmail_v1.Schema$Message,
    config: SyncConfig
  ): Promise<void> {
    // Parsear email
    const parsed = EmailParser.parseMessage(message);

    // Truncar contenido si es necesario
    const content = EmailParser.truncateContent(parsed.fullContent, config.maxEmailContentLength);

    // Generar embedding
    const embeddingModel = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const embeddingResult = await embeddingModel.embedContent(content);
    const embedding = embeddingResult.embedding.values;

    // Guardar en document_chunks
    const { error } = await this.supabase.from('document_chunks').insert({
      user_id: userId,
      source_type: 'gmail',
      source_id: parsed.id,
      content: content,
      embedding: embedding,
      metadata: {
        subject: parsed.subject,
        from: parsed.from,
        date: parsed.date.toISOString(),
        threadId: parsed.threadId,
        labels: parsed.labels,
        hasAttachments: parsed.metadata.hasAttachments,
        attachmentCount: parsed.metadata.attachmentCount,
        isStarred: parsed.metadata.isStarred,
        isImportant: parsed.metadata.isImportant,
      },
    });

    if (error) {
      throw new Error(`Error guardando email en DB: ${error.message}`);
    }

    console.log(`[GmailSync] ✓ Email guardado: ${parsed.subject.substring(0, 50)}...`);
  }

  /**
   * Obtiene la configuración de sincronización del usuario
   */
  private async getUserConfig(userId: string): Promise<SyncConfig> {
    const { data, error } = await this.supabase
      .from('gmail_sync_config')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // Crear configuración por defecto
      console.log('[GmailSync] No hay configuración, usando defaults');
      return {
        maxEmailsPerSync: 200,
        initialSyncDays: 15,
        excludedLabels: [],
        includedLabels: null,
        excludePromotions: true,
        excludeSocial: true,
        processAttachmentsNames: true,
        maxEmailContentLength: 50000,
      };
    }

    return {
      maxEmailsPerSync: data.max_emails_per_sync,
      initialSyncDays: data.initial_sync_days,
      excludedLabels: data.excluded_labels || [],
      includedLabels: data.included_labels,
      excludePromotions: data.exclude_promotions,
      excludeSocial: data.exclude_social,
      processAttachmentsNames: data.process_attachments_names,
      maxEmailContentLength: data.max_email_content_length,
    };
  }

  /**
   * Obtiene el cliente de Gmail configurado para un usuario
   */
  private async getGmailClient(userId: string): Promise<gmail_v1.Gmail> {
    // Obtener credenciales encriptadas
    const { data: creds, error } = await this.supabase
      .from('user_credentials')
      .select('encrypted_refresh_token, iv, auth_tag')
      .eq('user_id', userId)
      .eq('service_name', 'google')
      .single();

    if (error || !creds) {
      throw new Error(`No se encontraron credenciales de Google para el usuario ${userId}`);
    }

    // Desencriptar token
    const refreshToken = await decryptToken(creds as any);

    // Configurar OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    // Retornar cliente de Gmail
    return google.gmail({ version: 'v1', auth: oauth2Client });
  }

  /**
   * Obtiene el estado de sincronización actual
   */
  private async getSyncStatus(userId: string) {
    const { data } = await this.supabase
      .from('sync_status')
      .select('*')
      .eq('user_id', userId)
      .eq('service_name', 'google')
      .single();

    return data;
  }

  /**
   * Actualiza el estado de sincronización
   */
  private async updateSyncStatus(userId: string, historyId: string, resetErrors: boolean = false) {
    const updateData: any = {
      user_id: userId,
      service_name: 'google',
      last_sync_token: historyId,
      last_sync_at: new Date().toISOString(),
    };

    if (resetErrors) {
      updateData.error_count = 0;
      updateData.last_error = null;
      updateData.last_error_at = null;
    }

    const { error } = await this.supabase
      .from('sync_status')
      .upsert(updateData, { onConflict: 'user_id,service_name' });

    if (error) {
      console.error('[GmailSync] Error actualizando sync_status:', error.message);
    }
  }

  /**
   * Actualiza el registro de error en sync_status
   */
  private async updateSyncError(userId: string, errorMessage: string) {
    // Obtener error_count actual
    const { data } = await this.supabase
      .from('sync_status')
      .select('error_count')
      .eq('user_id', userId)
      .eq('service_name', 'google')
      .single();

    const currentErrorCount = data?.error_count || 0;

    await this.supabase
      .from('sync_status')
      .upsert({
        user_id: userId,
        service_name: 'google',
        last_error: errorMessage,
        last_error_at: new Date().toISOString(),
        error_count: currentErrorCount + 1,
      }, { onConflict: 'user_id,service_name' });
  }

  /**
   * Marca la primera sincronización como completada
   */
  private async markFirstSyncCompleted(userId: string, totalEmailsSynced: number) {
    await this.supabase
      .from('gmail_sync_config')
      .upsert({
        user_id: userId,
        first_sync_completed: true,
        first_sync_completed_at: new Date().toISOString(),
        total_emails_synced: totalEmailsSynced,
      }, { onConflict: 'user_id' });
  }

  /**
   * Configura Gmail Push Notifications (watch)
   */
  async setupGmailWatch(userId: string, topicName: string): Promise<{ success: boolean; expiration?: Date; error?: string }> {
    try {
      const gmail = await this.getGmailClient(userId);

      const watchResponse = await gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName: topicName,
          labelIds: ['INBOX'], // Solo monitorear INBOX
        },
      });

      const expiration = watchResponse.data.expiration
        ? new Date(parseInt(watchResponse.data.expiration))
        : undefined;

      // Guardar en configuración
      await this.supabase
        .from('gmail_sync_config')
        .upsert({
          user_id: userId,
          watch_enabled: true,
          watch_topic_name: topicName,
          watch_expiration: expiration?.toISOString(),
        }, { onConflict: 'user_id' });

      console.log(`[GmailSync] Watch configurado para usuario ${userId}, expira: ${expiration}`);

      return {
        success: true,
        expiration,
      };

    } catch (error: any) {
      console.error('[GmailSync] Error configurando Gmail watch:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Detiene Gmail Push Notifications
   */
  async stopGmailWatch(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const gmail = await this.getGmailClient(userId);

      await gmail.users.stop({
        userId: 'me',
      });

      // Actualizar configuración
      await this.supabase
        .from('gmail_sync_config')
        .update({
          watch_enabled: false,
          watch_topic_name: null,
          watch_expiration: null,
        })
        .eq('user_id', userId);

      console.log(`[GmailSync] Watch detenido para usuario ${userId}`);

      return { success: true };

    } catch (error: any) {
      console.error('[GmailSync] Error deteniendo Gmail watch:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
