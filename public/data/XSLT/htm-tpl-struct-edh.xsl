<?xml version="1.0" encoding="UTF-8"?>
<!-- $Id: htm-tpl-struct-edh.xsl 2490 2016-12-06 16:03:57Z gabrielbodard $ -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:t="http://www.tei-c.org/ns/1.0" exclude-result-prefixes="t" 
                version="2.0">
  <!-- Contains named templates for EDH file structure (aka "metadata" aka "supporting data") -->  
   
   <!-- Called from htm-tpl-structure.xsl -->
   
   <xsl:template name="edh-structure">
      <xsl:call-template name="default-structure"/>
   </xsl:template>
   
   </xsl:stylesheet>
