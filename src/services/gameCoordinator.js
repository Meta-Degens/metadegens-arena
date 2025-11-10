import Agent from '../models/Agent.js';
import casinoApi from './casinoApi.js';
import logger from '../utils/logger.js';
import { config } from '../config/config.js';

class GameCoordinator {
  constructor() {
    this.agents = [];
    this.availableGames = [];
    this.isRunning = false;
  }

  async initialize(agentCount = config.agent.agentsCount) {
    logger.info('Initializing game coordinator with ' + agentCount + ' agents');

    try {
      this.availableGames = await casinoApi.getAvailableGames();
      logger.info('Fetched available games', { games: this.availableGames });
    } catch (error) {
      logger.error('Failed to fetch available games', { error: error.message });
      this.availableGames = [
        { id: 'blackjack', name: 'Blackjack', minBet: 10 },
        { id: 'roulette', name: 'Roulette', minBet: 5 },
        { id: 'slots', name: 'Slots', minBet: 1 }
      ];
      logger.info('Using fallback games list');
    }

    for (let i = 1; i <= agentCount; i++) {
      const agent = new Agent(i);
      const initialized = await agent.initialize();
      
      if (initialized) {
        this.agents.push(agent);
      }
    }

    logger.info('Initialized ' + this.agents.length + ' agents successfully');
    return this.agents.length > 0;
  }

  async runGameLoop() {
    if (this.agents.length === 0) {
      logger.error('No agents available to run game loop');
      return;
    }

    this.isRunning = true;
    const maxRounds = config.agent.maxRounds;
    const isInfinite = maxRounds === 0;
    let round = 0;

    logger.info('Starting game loop', {
      maxRounds: isInfinite ? 'infinite' : maxRounds,
      agents: this.agents.length
    });

    while (this.isRunning && (isInfinite || round < maxRounds)) {
      round++;
      const activeAgents = this.agents.filter(a => a.isActive);

      if (activeAgents.length === 0) {
        logger.info('No active agents remaining, ending game loop');
        break;
      }

      const roundLabel = isInfinite ? 'Round ' + round : 'Round ' + round + '/' + maxRounds;
      logger.info(roundLabel, { activeAgents: activeAgents.length });

      for (const agent of activeAgents) {
        await agent.playRound(this.availableGames);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (round % 10 === 0) {
        this.printIntermediateStats(round);
      }
    }

    this.isRunning = false;
    logger.info('Game loop completed');
    await this.printFinalStats();
  }

  printIntermediateStats(round) {
    logger.info('===== Round ' + round + ' Intermediate Stats =====');
    
    for (const agent of this.agents) {
      const stats = agent.getStats();
      logger.info(stats.agentId + ' Stats', {
        balance: '$' + stats.currentBalance.toFixed(2),
        profit: '$' + stats.netProfit.toFixed(2),
        games: stats.totalGames,
        winRate: stats.winRate,
        active: stats.isActive
      });
    }
  }

  async printFinalStats() {
    logger.info('===== FINAL STATISTICS =====');
    
    const allStats = [];
    
    for (const agent of this.agents) {
      const stats = agent.getStats();
      allStats.push(stats);
      
      logger.info('');
      logger.info('Agent: ' + stats.agentId);
      logger.info('  Starting Balance: $' + stats.startBalance.toFixed(2));
      logger.info('  Final Balance: $' + stats.currentBalance.toFixed(2));
      logger.info('  Net Profit/Loss: $' + stats.netProfit.toFixed(2));
      logger.info('  ROI: ' + stats.roi);
      logger.info('  Total Games: ' + stats.totalGames);
      logger.info('  Wins: ' + stats.wins);
      logger.info('  Losses: ' + stats.losses);
      logger.info('  Win Rate: ' + stats.winRate);
      logger.info('  Total Bet: $' + stats.totalBet.toFixed(2));
      logger.info('  Total Won: $' + stats.totalWon.toFixed(2));
      
      try {
        const analysis = await agent.getSessionAnalysis();
        logger.info('  AI Analysis: ' + analysis);
      } catch (error) {
        logger.error('  Failed to get AI analysis');
      }
    }

    const totalStartBalance = allStats.reduce((sum, s) => sum + s.startBalance, 0);
    const totalEndBalance = allStats.reduce((sum, s) => sum + s.currentBalance, 0);
    const totalProfit = totalEndBalance - totalStartBalance;
    const totalGames = allStats.reduce((sum, s) => sum + s.totalGames, 0);
    const totalWins = allStats.reduce((sum, s) => sum + s.wins, 0);
    const totalLosses = allStats.reduce((sum, s) => sum + s.losses, 0);

    logger.info('');
    logger.info('===== AGGREGATE STATISTICS =====');
    logger.info('Total Starting Balance: $' + totalStartBalance.toFixed(2));
    logger.info('Total Final Balance: $' + totalEndBalance.toFixed(2));
    logger.info('Total Profit/Loss: $' + totalProfit.toFixed(2));
    logger.info('Total Games Played: ' + totalGames);
    logger.info('Total Wins: ' + totalWins);
    logger.info('Total Losses: ' + totalLosses);
    logger.info('Overall Win Rate: ' + ((totalWins / totalGames) * 100).toFixed(2) + '%');
  }

  stop() {
    this.isRunning = false;
    logger.info('Game coordinator stopped');
  }
}

export default GameCoordinator;
