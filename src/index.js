import GameCoordinator from './services/gameCoordinator.js';
import logger from './utils/logger.js';
import { config } from './config/config.js';

async function main() {
  logger.info('===== Casino AI Agent System Starting =====');
  logger.info('Configuration:', {
    agentCount: config.agent.agentsCount,
    initialBalance: config.casino.initialBalance,
    maxRounds: config.agent.maxRounds === 0 ? 'infinite' : config.agent.maxRounds,
    model: config.openRouter.model
  });

  if (!config.openRouter.apiKey) {
    logger.error('OpenRouter API key not configured. Please set OPENROUTER_API_KEY in .env file');
    process.exit(1);
  }

  const coordinator = new GameCoordinator();

  const initialized = await coordinator.initialize(config.agent.agentsCount);

  if (!initialized) {
    logger.error('Failed to initialize game coordinator');
    process.exit(1);
  }

  process.on('SIGINT', () => {
    logger.info('Received SIGINT, gracefully shutting down...');
    coordinator.stop();
  });

  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, gracefully shutting down...');
    coordinator.stop();
  });

  try {
    await coordinator.runGameLoop();
    logger.info('===== Casino AI Agent System Completed =====');
  } catch (error) {
    logger.error('Fatal error in game loop', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

main().catch(error => {
  logger.error('Unhandled error in main', { error: error.message, stack: error.stack });
  process.exit(1);
});
