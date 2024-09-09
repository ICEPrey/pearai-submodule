import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../index.js";
import { walkDir } from "../../indexing/walkDir.js";
import { splitPath, getBasename } from "../../util/index.js";
import { BaseContextProvider } from "../index.js";

interface Directory {
  name: string;
  files: string[];
  directories: Directory[];
}

function formatFileTree(tree: Directory, indentation = ""): string {
  let result = "";
  for (const file of tree.files) {
    result += `${indentation}${file}\n`;
  }
  for (const directory of tree.directories) {
    result += `${indentation}${directory.name}/\n`;
    result += formatFileTree(directory, `${indentation}  `);
  }
  return result;
}

class BeginnerContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "beginner",
    displayTitle: "Beginner",
    description: "Provide context-aware assistance for beginners",
    type: "normal",
    renderInlineAs: "",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const { ide } = extras;

    const currentFile = await ide.getCurrentFile();
    if (!currentFile) {
      return [];
    }

    const fileContent = await ide.readFile(currentFile);
    const fileExtension = getBasename(currentFile).split(".").pop() || "";

    // Get file tree
    const workspaceDirs = await extras.ide.getWorkspaceDirs();
    const trees = [];
    for (const workspaceDir of workspaceDirs) {
      const contents = await walkDir(workspaceDir, extras.ide);
      const subDirTree: Directory = {
        name: splitPath(workspaceDir).pop() ?? "",
        files: [],
        directories: [],
      };
      for (const file of contents) {
        const parts = splitPath(file, workspaceDir);
        let currentTree = subDirTree;
        for (const part of parts.slice(0, -1)) {
          if (!currentTree.directories.some((d) => d.name === part)) {
            currentTree.directories.push({
              name: part,
              files: [],
              directories: [],
            });
          }
          currentTree = currentTree.directories.find((d) => d.name === part)!;
        }
        currentTree.files.push(parts.pop()!);
      }
      trees.push(formatFileTree(subDirTree));
    }

    const beginnerContext = `
When responding to this query:
- Assume the user is a beginner who is new to the current project, technologies, programming language, and possibly coding altogether
- The current file is: ${getBasename(currentFile)}
- Use latest frameworks and technologies when possible, especially those relevant to ${fileExtension} files
- Be specific about instructions you give since the user might not know common assumptions
- Explain technical terms and concepts when they're first introduced
- Provide step-by-step guidance when explaining processes or solutions
- Use simple language and avoid jargon where possible
- Offer examples to illustrate complex ideas, preferably related to ${fileExtension} files
- Consider the project structure when giving advice. Here's a simplified view of the project structure:

${trees.join("\n\n")}

- Encourage the user to ask follow-up questions if anything is unclear
- If relevant, suggest resources for further learning about concepts related to ${fileExtension} files

Current file content:
\`\`\`${fileExtension}
${fileContent}
\`\`\`
    `.trim();

    return [
      {
        name: "Beginner-Friendly Context",
        description: `Beginner context for ${getBasename(currentFile)}`,
        content: beginnerContext,
      },
    ];
  }
}

export default BeginnerContextProvider;
