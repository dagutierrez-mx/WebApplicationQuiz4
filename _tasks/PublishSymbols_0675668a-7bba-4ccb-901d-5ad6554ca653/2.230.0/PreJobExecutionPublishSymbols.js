var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const path = require('path');
const clientToolUtils = require('azure-pipelines-tasks-packaging-common/universal/ClientToolUtilities');
const tl = require('azure-pipelines-task-lib');
const toolName = "symbol";
function PreJobExecutionPublishSymbols() {
    return __awaiter(this, void 0, void 0, function* () {
        tl.setResourcePath(path.join(__dirname, "task.json"));
        const UseNetCoreClientTool = tl.getBoolInput("UseNetCoreClientTool", false);
        try {
            // feature flag true or none Windows, then download NetCore version of client tool
            if (UseNetCoreClientTool || tl.osType() != "Windows_NT") {
                // Getting NetCore client tool
                tl.debug("Getting NetCore client tool");
                let clientToolFilePath = "/fake/path";
                // Downloading the correct version of Symbol to target location
                const accessToken = clientToolUtils.getSystemAccessToken();
                const serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);
                const blobUri = yield clientToolUtils.getBlobstoreUriFromBaseServiceUri(serviceUri, accessToken);
                tl.debug(tl.loc("Info_RetrievingClientToolUri", blobUri));
                // Downloading the client tool
                clientToolFilePath = yield clientToolUtils.retryOnExceptionHelper(() => clientToolUtils.getClientToolFromService(blobUri, accessToken, toolName), 3, 1000);
                tl.setTaskVariable('SYMBOLTOOL_FILE_PATH', clientToolFilePath);
            }
        }
        catch (error) {
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, tl.loc("PreJobFailedToExecute"));
        }
    });
}
PreJobExecutionPublishSymbols();
//# sourceMappingURL=PreJobExecutionPublishSymbols.js.map