import casinoApi from '../services/casinoApi.js';
import llmService from '../services/llmService.js';
import logger from '../utils/logger.js';
import { config } from '../config/config.js';

class Agent {
  constructor(id) {
    this.id = 'agent_' + id;
    this.balance = config.casino.initialBalance;
    this.gameHistory = [];
    this.wins = 0;
    this.losses = 0;
    this.totalBet = 0;
    this.totalWon = 0;
    this.isActive = false;
  }

  async initialize() {
    try {
      const account = await casinoApi.createAccount(this.id);
      this.balance = account.balance;
      this.isActive = true;
      logger.info('Agent initialized: ' + this.id, { balance: this.balance });
      return true;
    } catch (error) {
      logger.error('Failed to initialize agent: ' + this.id, { error: error.message });
      return false;
    }
  }

  async playRound(availableGames) {
    if (!this.isActive) {
      return null;
    }

    try {
      this.balance = await casinoApi.getBalance(this.id);
      
      if (this.balance <= 0) {
        logger.warn(this.id + ' is out of funds', { balance: this.balance });
        this.isActive = false;
        return null;
      }

      const decision = await llmService.getGameDecision({
        playerId: this.id,
        balance: this.balance,
        availableGames: availableGames,
        recentHistory: this.gameHistory
      });

      if (decision.action === 'stop') {
        logger.info(this.id + ' decided to stop playing', { reasoning: decision.reasoning });
        this.isActive = false;
        return null;
      }

      if (decision.action === 'play') {
        const betAmount = Math.min(decision.betAmount, this.balance);
        
        if (betAmount <= 0) {
          logger.warn(this.id + ' attempted invalid bet', { betAmount: betAmount });
          this.isActive = false;
          return null;
        }

        const result = await casinoApi.placeBet(
          this.id,
          decision.gameId,
          betAmount,
          decision.gameOptions || {}
        );

        this.gameHistory.push({
          game: decision.gameId,
          bet: betAmount,
          won: result.won,
          payout: result.payout,
          balance: result.newBalance,
          timestamp: new Date().toISOString()
        });

        this.balance = result.newBalance;
        this.totalBet += betAmount;

        if (result.won) {
          this.wins++;
          this.totalWon += result.payout;
        } else {
          this.losses++;
        }

        return result;
      }

      return null;
    } catch (error) {
      logger.error('Error during ' + this.id + ' play round', { error: error.message });
      return null;
    }
  }

  getStats() {
    const totalGames = this.wins + this.losses;
    const winRate = totalGames > 0 ? ((this.wins / totalGames) * 100).toFixed(2) : 0;
    const netProfit = this.balance - config.casino.initialBalance;
    const roi = ((netProfit / config.casino.initialBalance) * 100).toFixed(2);

    return {
      agentId: this.id,
      startBalance: config.casino.initialBalance,
      currentBalance: this.balance,
      netProfit: netProfit,
      roi: roi + '%',
      totalGames: totalGames,
      wins: this.wins,
      losses: this.losses,
      winRate: winRate + '%',
      totalBet: this.totalBet,
      totalWon: this.totalWon,
      isActive: this.isActive
    };
  }

  async getSessionAnalysis() {
    try {
      const stats = this.getStats();
      const analysis = await llmService.analyzeSession({
        playerId: this.id,
        startBalance: config.casino.initialBalance,
        endBalance: this.balance,
        totalGames: stats.totalGames,
        wins: this.wins,
        losses: this.losses
      });
      return analysis;
    } catch (error) {
      logger.error('Failed to get session analysis for ' + this.id, { error: error.message });
      return 'Analysis unavailable';
    }
  }
}

export default Agent;
