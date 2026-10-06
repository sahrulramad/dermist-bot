import { Events } from 'discord.js';
import { trackVoiceJoin, trackVoiceLeave, resetVoiceAfk } from '../utils/voice-afk.js';
import { log } from '../utils/logger.js';

export default {
  name: Events.VoiceStateUpdate,
  execute(oldState, newState) {
    const userId = newState.id;

    const wasInVoice = oldState.channelId;
    const isInVoice = newState.channelId;

    if (!wasInVoice && isInVoice) {
      trackVoiceJoin(userId, isInVoice);
      log(`Voice join: ${newState.member?.user.tag ?? userId} → <#${isInVoice}>`, 'info');
    } else if (wasInVoice && !isInVoice) {
      trackVoiceLeave(userId);
      log(`Voice leave: ${newState.member?.user.tag ?? userId}`, 'info');
    } else if (wasInVoice && isInVoice && wasInVoice !== isInVoice) {
      trackVoiceLeave(userId);
      trackVoiceJoin(userId, isInVoice);
      log(`Voice move: ${newState.member?.user.tag ?? userId} → <#${isInVoice}>`, 'info');
    } else if (isInVoice) {
      // User mengubah kondisi mic/audio/stream
      if (!newState.selfDeaf && !newState.selfMute) {
        resetVoiceAfk(userId);
      }
      if (newState.streaming || newState.selfVideo) {
        resetVoiceAfk(userId);
      }
    }
  },
};

