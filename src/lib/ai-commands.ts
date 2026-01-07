import Anthropic from "@anthropic-ai/sdk";

/**
 * Model performance analytics and statistics tracking
 */
interface ModelStats {
  successCount: number;
  errorCount: number;
  totalRequests: number;
  averageConfidence: number;
  fallbackCount: number;
  averageLatency: number; // in milliseconds
  lastUsed: Date;
}

interface PerformanceAnalytics {
  "grok-2": ModelStats;
  "grok-3": ModelStats;
  totalRequests: number;
  fallbacksTriggered: number;
  lowConfidenceDetections: number;
  averageConfidenceOverall: number;
}

/**
 * AI Command execution result with confidence and analytics
 */
interface CommandResult {
  success: boolean;
  data: Record<string, unknown>;
  confidence: number;
  modelUsed: string;
  fallbackUsed: boolean;
  error?: string;
  executionTime: number; // in milliseconds
}

/**
 * Initialize performance analytics
 */
const initializeAnalytics = (): PerformanceAnalytics => ({
  "grok-2": {
    successCount: 0,
    errorCount: 0,
    totalRequests: 0,
    averageConfidence: 0,
    fallbackCount: 0,
    averageLatency: 0,
    lastUsed: new Date(),
  },
  "grok-3": {
    successCount: 0,
    errorCount: 0,
    totalRequests: 0,
    averageConfidence: 0,
    fallbackCount: 0,
    averageLatency: 0,
    lastUsed: new Date(),
  },
  totalRequests: 0,
  fallbacksTriggered: 0,
  lowConfidenceDetections: 0,
  averageConfidenceOverall: 0,
});

class AICommandExecutor {
  private client: Anthropic;
  private analytics: PerformanceAnalytics;
  private confidenceThreshold: number = 0.75;
  private primaryModel: string = "claude-3-5-sonnet-20241022"; // grok-2 equivalent
  private fallbackModel: string = "claude-3-5-sonnet-20241022"; // grok-3 equivalent

  constructor() {
    this.client = new Anthropic();
    this.analytics = initializeAnalytics();
  }

  /**
   * Update model statistics after execution
   */
  private updateStats(
    model: string,
    success: boolean,
    confidence: number,
    latency: number,
    isFallback: boolean = false
  ): void {
    const modelKey = model as keyof PerformanceAnalytics;
    if (modelKey in this.analytics && typeof this.analytics[modelKey] === "object") {
      const stats = this.analytics[modelKey] as ModelStats;
      stats.totalRequests += 1;
      stats.lastUsed = new Date();

      if (success) {
        stats.successCount += 1;
        stats.averageConfidence =
          (stats.averageConfidence * (stats.successCount - 1) + confidence) /
          stats.successCount;
      } else {
        stats.errorCount += 1;
      }

      if (isFallback) {
        stats.fallbackCount += 1;
      }

      // Update average latency
      const totalLatency = stats.averageLatency * (stats.totalRequests - 1) + latency;
      stats.averageLatency = totalLatency / stats.totalRequests;
    }

    // Update overall analytics
    this.analytics.totalRequests += 1;
    const currentAverage = this.analytics.averageConfidenceOverall;
    this.analytics.averageConfidenceOverall =
      (currentAverage * (this.analytics.totalRequests - 1) + confidence) /
      this.analytics.totalRequests;
  }

  /**
   * Execute AI command with hybrid fallback strategy
   * Primary: grok-2 → Fallback: grok-3 on error or confidence < 0.75
   */
  async executeCommand(
    prompt: string,
    context?: Record<string, unknown>
  ): Promise<CommandResult> {
    const startTime = Date.now();
    let result: CommandResult | null = null;
    let primaryAttemptFailed = false;

    // Attempt 1: Try primary model (grok-2)
    try {
      result = await this.executeWithModel(
        this.primaryModel,
        prompt,
        context,
        false
      );

      // Check if confidence is below threshold
      if (result.confidence < this.confidenceThreshold) {
        this.analytics.lowConfidenceDetections += 1;
        primaryAttemptFailed = true;
      }
    } catch (error) {
      primaryAttemptFailed = true;
    }

    // Fallback to secondary model (grok-3) if primary failed
    if (primaryAttemptFailed) {
      this.analytics.fallbacksTriggered += 1;
      result = await this.executeWithModel(
        this.fallbackModel,
        prompt,
        context,
        true
      );
    }

    if (!result) {
      throw new Error("Failed to execute command with both primary and fallback models");
    }

    const executionTime = Date.now() - startTime;
    result.executionTime = executionTime;

    return result;
  }

  /**
   * Execute command with a specific model
   */
  private async executeWithModel(
    model: string,
    prompt: string,
    context?: Record<string, unknown>,
    isFallback: boolean = false
  ): Promise<CommandResult> {
    const startTime = Date.now();

    try {
      const systemPrompt = `You are an AI assistant specializing in inventory management commands. 
You must respond with a JSON object containing:
- "success": boolean indicating if the command was understood and can be executed
- "data": object with parsed command details
- "confidence": number between 0 and 1 indicating confidence in the interpretation
- "command_type": string describing the type of command
${context ? `- Additional context: ${JSON.stringify(context)}` : ""}

Always respond with valid JSON only, no additional text.`;

      const response = await this.client.messages.create({
        model: model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const latency = Date.now() - startTime;
      const responseText =
        response.content[0].type === "text" ? response.content[0].text : "";

      // Parse AI response
      const parsedResponse = this.parseAIResponse(responseText);

      // Validate confidence level
      if (
        !parsedResponse.confidence ||
        parsedResponse.confidence < 0 ||
        parsedResponse.confidence > 1
      ) {
        throw new Error("Invalid confidence value in AI response");
      }

      this.updateStats(model, true, parsedResponse.confidence, latency, isFallback);

      return {
        success: true,
        data: parsedResponse,
        confidence: parsedResponse.confidence,
        modelUsed: model,
        fallbackUsed: isFallback,
        executionTime: latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      this.updateStats(model, false, 0, latency, isFallback);

      throw new Error(
        `Model ${model} failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Parse and validate AI response
   */
  private parseAIResponse(
    responseText: string
  ): Record<string, unknown> & { confidence: number } {
    try {
      const parsed = JSON.parse(responseText);

      // Ensure confidence field exists and is valid
      if (typeof parsed.confidence !== "number") {
        parsed.confidence = 0.5; // Default confidence if not provided
      }

      return {
        ...parsed,
        confidence: Math.max(0, Math.min(1, parsed.confidence)), // Clamp between 0-1
      };
    } catch (error) {
      throw new Error(`Failed to parse AI response: ${String(error)}`);
    }
  }

  /**
   * Get current performance analytics
   */
  getAnalytics(): PerformanceAnalytics {
    return JSON.parse(JSON.stringify(this.analytics));
  }

  /**
   * Get detailed statistics for a specific model
   */
  getModelStats(model: "grok-2" | "grok-3"): ModelStats | null {
    const modelKey = model as keyof PerformanceAnalytics;
    if (modelKey in this.analytics && typeof this.analytics[modelKey] === "object") {
      return JSON.parse(
        JSON.stringify(this.analytics[modelKey])
      ) as ModelStats;
    }
    return null;
  }

  /**
   * Reset analytics
   */
  resetAnalytics(): void {
    this.analytics = initializeAnalytics();
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalRequests: number;
    successRate: number;
    fallbackRate: number;
    averageConfidence: number;
    lowConfidenceRate: number;
  } {
    const modelStats = Object.entries(this.analytics).filter(
      ([key]) => key !== "totalRequests" && key !== "fallbacksTriggered" && key !== "lowConfidenceDetections" && key !== "averageConfidenceOverall"
    );

    const totalSuccess = (modelStats as [string, ModelStats][]).reduce(
      (sum, [, stats]) => sum + stats.successCount,
      0
    );

    const totalErrors = (modelStats as [string, ModelStats][]).reduce(
      (sum, [, stats]) => sum + stats.errorCount,
      0
    );

    const successRate =
      this.analytics.totalRequests > 0
        ? totalSuccess / this.analytics.totalRequests
        : 0;

    const fallbackRate =
      this.analytics.totalRequests > 0
        ? this.analytics.fallbacksTriggered / this.analytics.totalRequests
        : 0;

    const lowConfidenceRate =
      this.analytics.totalRequests > 0
        ? this.analytics.lowConfidenceDetections / this.analytics.totalRequests
        : 0;

    return {
      totalRequests: this.analytics.totalRequests,
      successRate: parseFloat(successRate.toFixed(4)),
      fallbackRate: parseFloat(fallbackRate.toFixed(4)),
      averageConfidence: parseFloat(
        this.analytics.averageConfidenceOverall.toFixed(4)
      ),
      lowConfidenceRate: parseFloat(lowConfidenceRate.toFixed(4)),
    };
  }
}

// Export singleton instance
export const aiCommandExecutor = new AICommandExecutor();

// Export types
export type { CommandResult, PerformanceAnalytics, ModelStats };

// Export functions for AI command execution
export async function executeInventoryCommand(
  prompt: string,
  context?: Record<string, unknown>
): Promise<CommandResult> {
  return aiCommandExecutor.executeCommand(prompt, context);
}

export function getPerformanceAnalytics(): PerformanceAnalytics {
  return aiCommandExecutor.getAnalytics();
}

export function getPerformanceSummary() {
  return aiCommandExecutor.getSummary();
}

export function resetPerformanceMetrics(): void {
  aiCommandExecutor.resetAnalytics();
}
