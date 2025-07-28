<?xml version="1.0" encoding="UTF-8"?>
<!-- $Id: htm-tpl-lang.xsl 2354 2015-05-08 16:28:41Z paregorios $ -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:t="http://www.tei-c.org/ns/1.0" exclude-result-prefixes="t" 
                version="2.0">
  <!-- Contains all language related named templates -->  
  
  <xsl:template name="attr-lang">
      <xsl:if test="ancestor-or-self::t:*[@xml:lang]">
         <xsl:attribute name="lang">
            <xsl:value-of select="ancestor-or-self::t:*[@xml:lang][1]/@xml:lang"/>
         </xsl:attribute>
      </xsl:if>
  </xsl:template>
  
</xsl:stylesheet>