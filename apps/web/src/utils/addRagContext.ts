/* eslint-disable @typescript-eslint/no-unused-vars */
import { useCanvasStore } from "@/store/useCanvasStore";
import { HumanMessage } from "@langchain/core/messages";

// Types for API responses
type UserInfoResponse = any;

interface AuthData {
  token: string;
  userId: string | number;
}

let authData: AuthData | null = null;

// Initialize message listener on client side only
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    // Verify the origin of the message
    const allowedOrigins = [process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://localhost:4200'];
    if (!allowedOrigins.includes(event.origin)) {
      console.warn('Received message from unexpected origin:', event.origin);
      return;
    }

    try {
      const message = event.data;
      if (message.type === 'INIT' && message.auth) {
        authData = message.auth;
        console.log('Received authentication data');
      } else if (message.type === 'INIT' && message.data.userData) {
        useCanvasStore.getState().setUserData(message.data.userData);
        console.log('Received and stored user data');
      } else if (message.type === 'USER_DATA_RESPONSE') {
        useCanvasStore.getState().setUserData(message.data);
        console.log('Received and stored updated user data');
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
}

// Request user data from parent
function requestUserData(): void {
  if (typeof window !== 'undefined' && window.parent) {
    window.parent.postMessage(
      { type: 'REQUEST_USER_DATA' },
      process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://localhost:4200'
    );
  }
}

// Validation functions
function validateUserInfo(data: unknown): UserInfoResponse {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid user info data");
  }

  return data;
}

function validateContextData(data: unknown): string {
  if (!Array.isArray(data)) {
    throw new Error("Context data must be an array");
  }

  return data.map((item) => `<context>${item.text}</context>`).join("\n\n");
}

// Fetch functions
async function fetchUserInfo(): Promise<UserInfoResponse> {
  const userData = useCanvasStore.getState().userData;
  if (!userData) {
    throw new Error("User data not available. Please ensure the canvas is properly initialized.");
  }

  return validateUserInfo(userData);
}

async function fetchContextData(userInput: string): Promise<string> {
  const contextUrl = process.env.NEXT_PUBLIC_CONTEXT_API_URL;
  if (!contextUrl) {
    throw new Error("Context API URL not configured");
  }

  const response = await fetch(`${contextUrl}/get-relevant-content`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: userInput, limit: 10 }),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch context data: ${response.statusText}`);
  }

  const data = await response.json();
  return validateContextData(data.message);
}

// Formatter functions
function formatUserInfo(userInfo: any): string {
  const { anamnese, exams } = userInfo;
  const formattedMarkers = exams
    .map((exam: any) => `${exam.name} - ${exam.value} ${exam.unit}`)
    .join("\n");

  return `<anamnese>${JSON.stringify(anamnese)}</anamnese>\n\n<marcadores-sanguineos>${formattedMarkers}</marcadores-sanguineos>`;
}

const BASE_PROMPT = `
Sua tarefa é elaborar uma receita para o paciente. Você vai interagir diretamente com o médico, e vocês irão construí-la juntos.
Contextos serão fornecidos e delimitados pelas tags <context></context>. Você DEVE utilizar esses contextos como FONTE PRINCIPAL de conhecimento para elaborar a receita. Caso não seja possível utilizar apenas esses contextos, você pode utilizar seu conhecimento próprio.
<formatacao-receituario>
Gere um receituário médico contendo posologias para o paciente.
Inclua um cabeçalho com as principais informações do paciente (nome, peso, altura, etc.) e um rodapé com as informações relevantes do médico, para serem preenchidas.
Utilize o seguinte formato para o corpo da receita:
1- Nome da Posologia.........................................quantidade
Ingrediente 1.................................................quantidade
Ingrediente 2.................................................quantidade
Ingrediente 3.................................................quantidade
- Instruções detalhadas sobre o modo de administração, incluindo intervalos de tempo, condições específicas e outras observações relevantes.
- Se necessário, adicione notas sobre avaliações específicas antes ou durante o tratamento.
Repita este formato para cada posologia adicional, numerando-as sequencialmente.
SEMPRE inclua duas linhas em branco entre cada posologia.
</formatacao-receituario>
Serão fornecidas as seguintes informações:
- Anamnese
- Resutlados de Exames
- Diagnóstico
- Pergunta do médico
Você deve considerar a anamnese, resultados de exames e diagnostico para responder a pergunta do médico. Não considere a anamnese, resultados e diagnostico como parte da pergunta.
Você deve responder apenas a pergunta do médico, sem nenhum outro texto adicional.
`

export async function addRagContext(message: string): Promise<string> {
  // Initialize empty strings for successful responses
  let formattedUserInfo = "";
  let formattedContext = "";

  // Fetch user info
  try {
    const userInfo = await fetchUserInfo();
    console.log("[addRagContext] userInfo", userInfo);
    formattedUserInfo = formatUserInfo(userInfo.data);
  } catch (error) {
    console.error("Error fetching user info:", error);
  }

  // Fetch context data
  try {
    const contextData = await fetchContextData(message);
    // console.log("[addRagContext] contextData", contextData);
    formattedContext = contextData;
  } catch (error) {
    console.error("Error fetching context data:", error);
  }

  // console.log("formattedUserInfo", formattedUserInfo);
  // console.log("formattedContext", formattedContext);

  // Build response with any successful data
  let response = BASE_PROMPT + "\n\n";
  if (formattedUserInfo) {
    response += formattedUserInfo + "\n\n";
  }
  if (formattedContext) {
    response += formattedContext + "\n\n";
  }
  response += `<pergunta-medico>\n${message}\n</pergunta-medico>`;

  return response;
}

export function getOriginalMessage(message: HumanMessage): HumanMessage {
  const messageContent = message.content;
  if (typeof messageContent !== 'string') {
    return message;
  }

  const regex = /<pergunta-medico>\n?(.*?)\n?<\/pergunta-medico>/s;
  const match = messageContent.match(regex);
  console.log("[getOriginalMessage] match", match);
  
  if (match) message.content = match[1];
  return message;
}