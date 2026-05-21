import "@typespec/http";
import "@typespec/openapi3";
import "@microsoft/typespec-m365-copilot";
import "./actions/github.tsp";
import "./prompts/instructions.tsp";
import "./env.tsp";

using TypeSpec.M365.Copilot.Agents;

@agent(
  "rintu",
  "Declarative agent created with Microsoft 365 Agents Toolkit and TypeSpec for Microsoft 365 Copilot."
)
@instructions(Prompts.INSTRUCTIONS)
// Conversation starter shown to users when the agent is first created.
@conversationStarter(#{ title: "Search GitHub issues", text: "Show open issues for microsoft-365-agents-toolkit" })
namespace rintu {  
  // Expose the GitHub search action to the agent.
  op searchIssues is GitHubAPI.searchIssues;
}