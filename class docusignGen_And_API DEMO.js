public class docusignGen_And_API {
    // Must be a list in order to be called via Flow, this isn't necessary if Flow is not used
    @InvocableMethod(label='docusignGen_And_API')
    public static List<String> sendEnvelope(List<String> record) {
        System.debug(record);  
        Id recordId = record[0];
        System.debug(recordId);
        gen_and_convert(recordId);
        return Null;
    }    

    @future(callout = true)  
    public static void gen_and_convert(Id recordId){
        // Example opportunity record Id 006Ho00000Ra4e1IAB = Burlington Textile
        
        String jsonBody = bodyJSON(recordId);  // Create the message body for DocuSign endpoint /restapi/v2.1/accounts/{accountId}/envelopes/generate_and_convert
        System.debug(jsonBody); 
        HttpRequest req = new HttpRequest();
        req.setEndpoint('callout:{NamedCredential}/restapi/v2.1/accounts/{AccountId}/envelopes/generate_and_convert'); // API call to DocuSign endpoint 
        req.setHeader('Content-Type', 'application/json');
        req.setMethod('POST');
        req.setBody(jsonBody); // Grab record data and template for API call
        Http http = new Http();
        HTTPResponse res = http.send(req);
        String responseBody = res.getBody(); // Generated document as base64
        System.debug(responseBody); 
        Blob blobContent = EncodingUtil.base64Decode(responseBody);
        
        DateTime now = System.now();
        String s = string.valueof(now); // Get current date/time   
        
        // Save generated document to Files
        ContentVersion v = new ContentVersion();
        v.VersionData = blobContent;
        v.Title = 'Gen API Doc '+ s;
        v.PathOnClient ='docusignGen_And_API.docx';
        insert v;
        v = [SELECT ContentDocumentId FROM ContentVersion WHERE Id =: v.Id];
        ContentDocumentLink objCDL = new ContentDocumentLink(
            ContentDocumentId = v.ContentDocumentId,
            LinkedEntityId = recordId,
            Visibility = 'AllUsers'
        );
        insert objCDL;         
    }  
    
    public static String bodyJSON(Id recordId){
        
        // Grab the template document and convert into base64 Blob for document generation body
        ContentVersion file = [SELECT VersionData FROM ContentVersion WHERE IsLatest = TRUE AND ContentDocumentId  = '{TemplateContentDocumentId}' LIMIT 1];
        Blob fileBlob = file.VersionData;           
        String fileBase64 = EncodingUtil.base64Encode(fileBlob);       
        
        // Create the JSON body for the Document Generation API call
        JSONGenerator jsGen = SYSTEM.JSON.createGenerator(true);
        jsGen.writeStartObject();  
        jsGen.writeFieldName('generateProperties');
            jsGen.writeStartArray(); 
                jsGen.writeStartObject(); 
                jsGen.writeStringField('dataJson', opportunityRecord(recordId));  // Record Data
                jsGen.writeBlobField('base64GenerateTemplateDocument', fileBlob);  // Template Document
                jsGen.writeStringField('archiveDocumentType', 'DOCX');  // Response document type which can be XHTML, PDF, or DOCX
                jsGen.writeEndObject(); 
            jsGen.writeEndArray(); 
        jsGen.writeEndObject();
        String jsonData = jsGen.getAsString();
        return jsonData;
    }      

    // Create Opportunity record to JSON
    public static String opportunityRecord(Id recordId){
        // SOQL Opportunity fields you would like to make accessible creating the JSON
        Opportunity oppRec = [SELECT Id, Name, Amount, CloseDate, StageName, type FROM Opportunity WHERE Id = : recordId LIMIT 1]; 
        JSONGenerator jsGen = SYSTEM.JSON.createGenerator(true);
        // Create JSON data for Gen and call
        jsGen.writeStartObject();    
            jsGen.writeFieldName('Opportunity');
                jsGen.writeStartObject();
                jsGen.writeStringField('Id', oppRec.Id);
                jsGen.writeStringField('OpportunityName', oppRec.Name);
                jsGen.writeNumberField('Amount', oppRec.Amount);
                // Need to include IF statements for field values that may be blank to prevent errors
                if(oppRec.Type == null) {
                    jsGen.writeNullField('Type'); 
                } else {
                    jsGen.writeStringField('Type', oppRec.Type);
                }   
                DateTime dtCloseDate = oppRec.CloseDate.AddDays(1);
                String frmCloseDate = dtCloseDate.format('MM/dd/yyyy');        
                jsGen.writeStringField ('CloseDate', frmCloseDate);
                jsGen.writeStringField('StageName', oppRec.StageName);
                jsGen.writeFieldName('OpportunityLineItems');
                    jsGen.writeStartArray();
                    for(OpportunityLineItem   opplines : [SELECT Id,Name,Product2Id,Quantity,Product2.Name,Product2.ProductCode, UnitPrice, TotalPrice FROM OpportunityLineItem WHERE OpportunityId = : recordId]){    
                        jsGen.writeStartObject();  
                        jsGen.writeStringField('ProductCode', opplines.Product2.ProductCode);     
                        jsGen.writeStringField('Name', opplines.Product2.Name);  
                        jsGen.writeNumberField('Quantity', opplines.Quantity);   
                        jsGen.writeNumberField('UnitPrice', opplines.UnitPrice);   
                        jsGen.writeNumberField('TotalPrice', opplines.TotalPrice);                                            
                        jsGen.writeEndObject(); 
                    }
                    jsGen.writeEndArray();     
                jsGen.writeEndObject(); 
        jsGen.writeEndObject();
        
        String jsonData = jsGen.getAsString();
        System.debug('JSON Data: ' + jsonData);
        return jsonData;
    }                                   
    
}