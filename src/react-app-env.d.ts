/// <reference types="react-scripts" />

declare namespace NodeJS {
	interface ProcessEnv {
		readonly SOCKET_URL: string;
	}
}
