import { useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';

export function useSummaryTracking(summaryId: string) {
  const supabase = createSupabaseBrowserClient();

  const track = useCallback(async (
    interactionType: 'view' | 'click_notion' | 'click_gmail' | 'click_calendar' | 'copy_text',
    targetId?: string,
    targetUrl?: string,
    metadata?: Record<string, any>
  ) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(`/api/summaries/${summaryId}/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          interaction_type: interactionType,
          target_id: targetId,
          target_url: targetUrl,
          metadata
        })
      });
    } catch (error) {
      console.error('Error tracking interaction:', error);
      // No mostrar error al usuario, el tracking no debe interrumpir la UX
    }
  }, [summaryId, supabase]);

  const trackView = useCallback(() => {
    track('view');
  }, [track]);

  const trackNotionClick = useCallback((notionId: string, url: string) => {
    track('click_notion', notionId, url);
  }, [track]);

  const trackGmailClick = useCallback((threadId: string) => {
    track('click_gmail', threadId);
  }, [track]);

  const trackCalendarClick = useCallback((eventId: string, url: string) => {
    track('click_calendar', eventId, url);
  }, [track]);

  const trackCopyText = useCallback(() => {
    track('copy_text');
  }, [track]);

  return {
    trackView,
    trackNotionClick,
    trackGmailClick,
    trackCalendarClick,
    trackCopyText
  };
}
