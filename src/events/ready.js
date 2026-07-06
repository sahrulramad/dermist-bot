import { log } from '../utils/logger.js';

export default {
  name: 'clientReady',
  once: true,
  execute(client) {
    log(`Bot online sebagai ${client.user.tag} di ${client.guilds.cache.size} server`, 'success');
    client.user.setActivity('mengatur server', { type: 3 });
  },
};
