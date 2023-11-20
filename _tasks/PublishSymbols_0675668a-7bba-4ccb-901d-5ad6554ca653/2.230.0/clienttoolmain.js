"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const telemetry = require("azure-pipelines-tasks-utility-common/telemetry");
const tl = require("azure-pipelines-task-lib");
const publishSymbols = require("./PublishSymbols");
tl.setResourcePath(path.join(__dirname, "task.json"));
const clientToolFilePath = tl.getTaskVariable('SYMBOLTOOL_FILE_PATH');
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const indexSymbolsSet = tl.getBoolInput("IndexSources", false);
            if (indexSymbolsSet) {
                console.log(tl.loc("IndexingNotSupported"));
            }
            const needsToPublishSymbols = tl.getBoolInput("PublishSymbols", true);
            if (needsToPublishSymbols) {
                publishSymbols.run(clientToolFilePath);
            }
            else {
                tl.setResult(tl.TaskResult.Succeeded, tl.loc("PublishOptionNotSet"));
            }
        }
        catch (error) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("FailedToRunClientTool", error.message));
            return;
        }
        finally {
            logTelemetry(clientToolFilePath);
        }
    });
}
function logTelemetry(params) {
    try {
        let clientToolTelemetry = {
            "command": "publish",
            "clientToolPath": clientToolFilePath,
            "System.TeamFoundationCollectionUri": tl.getVariable("System.TeamFoundationCollectionUri"),
            "verbose": tl.getBoolInput("DetailedLog"),
        };
        telemetry.emitTelemetry("Symbol", "PublishSymbolsV2", clientToolTelemetry);
    }
    catch (err) {
        tl.debug(`Unable to log PublishSymbolsV2 task telemetry.Err: (${err} )`);
    }
}
main();
//# sourceMappingURL=clienttoolmain.js.map