import { extractUrls } from "@opencanvas/shared/utils/urls";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import {
  OpenCanvasGraphAnnotation,
  OpenCanvasGraphReturnType,
} from "../../state.js";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { dynamicDeterminePath } from "./dynamic-determine-path.js";
import {
  convertContextDocumentToHumanMessage,
  fixMisFormattedContextDocMessage,
} from "./documents.js";
import { getStringFromContent } from ".././../../utils.js";
import { includeURLContents } from "./include-url-contents.js";

function extractURLsFromLastMessage(messages: BaseMessage[]): string[] {
  const recentMessage = messages[messages.length - 1];
  console.log("recentMessage", recentMessage);
  const recentMessageContent = getStringFromContent(recentMessage.content);
  const messageUrls = extractUrls(recentMessageContent);
  return messageUrls;
}

/**
 * Routes to the proper node in the graph based on the user's query.
 */
export async function generatePath(
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> {
  console.log("=== GENERATE PATH LOG ===");
  console.log("Full State:", JSON.stringify(state, null, 2));
  console.log("Config:", JSON.stringify(config, null, 2));

  const { _messages } = state;
  console.log("_Messages:", JSON.stringify(_messages, null, 2));
  
  const newMessages: BaseMessage[] = [];
  const docMessage = await convertContextDocumentToHumanMessage(
    _messages,
    config
  );
  console.log("Doc Message:", JSON.stringify(docMessage, null, 2));
  const existingDocMessage = newMessages.find(
    (m) =>
      Array.isArray(m.content) &&
      m.content.some(
        (c) => c.type === "document" || c.type === "application/pdf"
      )
  );

  if (docMessage) {
    newMessages.push(docMessage);
  } else if (existingDocMessage) {
    const fixedMessages = await fixMisFormattedContextDocMessage(
      existingDocMessage,
      config
    );
    if (fixedMessages) {
      newMessages.push(...fixedMessages);
    }
  }

  if (state.highlightedCode) {
    return {
      next: "updateArtifact",
      ...(newMessages.length
        ? { messages: newMessages, _messages: newMessages }
        : {}),
    };
  }
  if (state.highlightedText) {
    return {
      next: "updateHighlightedText",
      ...(newMessages.length
        ? { messages: newMessages, _messages: newMessages }
        : {}),
    };
  }

  if (
    state.language ||
    state.artifactLength ||
    state.regenerateWithEmojis ||
    state.readingLevel
  ) {
    return {
      next: "rewriteArtifactTheme",
      ...(newMessages.length
        ? { messages: newMessages, _messages: newMessages }
        : {}),
    };
  }

  if (
    state.addComments ||
    state.addLogs ||
    state.portLanguage ||
    state.fixBugs
  ) {
    return {
      next: "rewriteCodeArtifactTheme",
      ...(newMessages.length
        ? { messages: newMessages, _messages: newMessages }
        : {}),
    };
  }

  if (state.customQuickActionId) {
    return {
      next: "customAction",
      ...(newMessages.length
        ? { messages: newMessages, _messages: newMessages }
        : {}),
    };
  }

  if (state.webSearchEnabled) {
    return {
      next: "webSearch",
      ...(newMessages.length
        ? { messages: newMessages, _messages: newMessages }
        : {}),
    };
  }

  // Check if any URLs are in the latest message. If true, determine if the contents should be included
  // inline in the prompt, and if so, scrape the contents and update the prompt.
  console.log("state._messages", state._messages);
  const messageUrls = extractURLsFromLastMessage(state._messages);
  console.log("messageUrls", messageUrls);
  let updatedMessageWithContents: HumanMessage | undefined = undefined;
  if (messageUrls.length) {
    updatedMessageWithContents = await includeURLContents(
      state._messages[state._messages.length - 1],
      messageUrls
    );
  }

  // Update the internal message list with the new message, if one was generated
  const newInternalMessageList = updatedMessageWithContents
    ? state._messages.map((m) => {
        if (m.id === updatedMessageWithContents.id) {
          return updatedMessageWithContents;
        } else {
          return m;
        }
      })
    : state._messages;

  const routingResult = await dynamicDeterminePath({
    state: {
      ...state,
      _messages: newInternalMessageList,
    },
    newMessages,
    config,
  });
  const route = routingResult?.route;
  if (!route) {
    throw new Error("Route not found");
  }

  // Create the messages object including the new messages if any
  const messages = newMessages.length
    ? {
        messages: newMessages,
        _messages: [...newInternalMessageList, ...newMessages],
      }
    : {
        _messages: newInternalMessageList,
      };

  return {
    next: route,
    ...messages,
  };
}
