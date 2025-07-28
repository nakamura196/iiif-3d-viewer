<?xml version="1.0" encoding="UTF-8"?>
<!-- $Id: start-edition.xsl 2476 2016-10-10 15:05:02Z pietroliuzzo $ -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
   xmlns:t="http://www.tei-c.org/ns/1.0"
   xmlns:xs="http://www.w3.org/2001/XMLSchema"
   exclude-result-prefixes="t" version="2.0">
   <xsl:output method="xml" encoding="UTF-8"/>

   <xsl:include href="/data/XSLT/global-varsandparams.xsl"/>

   <!-- html related stylesheets, these may import tei{element} stylesheets if relevant eg. htm-teigap and teigap -->
   <xsl:include href="/data/XSLT/htm-teiab.xsl"/>
   <xsl:include href="/data/XSLT/htm-teiaddanddel.xsl"/>
   <xsl:include href="/data/XSLT/htm-teiapp.xsl"/>
   <xsl:include href="/data/XSLT/htm-teidiv.xsl"/>
   <xsl:include href="/data/XSLT/htm-teidivedition.xsl"/>
   <xsl:include href="/data/XSLT/htm-teidivapparatus.xsl"/>
   <xsl:include href="/data/XSLT/htm-teiforeign.xsl"/>
   <xsl:include href="/data/XSLT/htm-teifigure.xsl"/>
   <xsl:include href="/data/XSLT/htm-teig.xsl"/>
   <xsl:include href="/data/XSLT/htm-teigap.xsl"/>
   <xsl:include href="/data/XSLT/htm-teihead.xsl"/>
   <xsl:include href="/data/XSLT/htm-teihi.xsl"/>
   <xsl:include href="/data/XSLT/htm-teilb.xsl"/>
   <xsl:include href="/data/XSLT/htm-teilgandl.xsl"/>
   <xsl:include href="/data/XSLT/htm-teilistanditem.xsl"/>
   <xsl:include href="/data/XSLT/htm-teilistbiblandbibl.xsl"/>
    <xsl:include href="/data/XSLT/htm-teimilestone.xsl"/>
    <xsl:include href="/data/XSLT/htm-teibibl.xsl"/>
   <xsl:include href="/data/XSLT/htm-teinote.xsl"/>
   <xsl:include href="/data/XSLT/htm-teinum.xsl"/>
   <xsl:include href="/data/XSLT/htm-teip.xsl"/>
   <xsl:include href="/data/XSLT/htm-teiseg.xsl"/>
   <xsl:include href="/data/XSLT/htm-teispace.xsl"/>
   <xsl:include href="/data/XSLT/htm-teisupplied.xsl"/>
   <xsl:include href="/data/XSLT/htm-teiterm.xsl"/>
   <xsl:include href="/data/XSLT/htm-teiref.xsl"/>

   <!-- tei stylesheets that are also used by start-txt -->
   <xsl:include href="/data/XSLT/teiabbrandexpan.xsl"/>
   <xsl:include href="/data/XSLT/teicertainty.xsl"/>
   <xsl:include href="/data/XSLT/teichoice.xsl"/>
   <xsl:include href="/data/XSLT/teihandshift.xsl"/>
   <xsl:include href="/data/XSLT/teiheader.xsl"/>
   <xsl:include href="/data/XSLT/teimilestone.xsl"/>
   <xsl:include href="/data/XSLT/teiorig.xsl"/>
   <xsl:include href="/data/XSLT/teiorigandreg.xsl"/>
   <xsl:include href="/data/XSLT/teiq.xsl"/>
   <xsl:include href="/data/XSLT/teisicandcorr.xsl"/>
   <xsl:include href="/data/XSLT/teispace.xsl"/>
   <xsl:include href="/data/XSLT/teisupplied.xsl"/>
   <xsl:include href="/data/XSLT/teisurplus.xsl"/>
   <xsl:include href="/data/XSLT/teiunclear.xsl"/>

   <!-- html related stylesheets for named templates -->
   <xsl:include href="/data/XSLT/htm-tpl-cssandscripts.xsl"/>
   <xsl:include href="/data/XSLT/htm-tpl-apparatus.xsl"/>
   <xsl:include href="/data/XSLT/htm-tpl-lang.xsl"/>
   <xsl:include href="/data/XSLT/htm-tpl-metadata.xsl"/>
   <xsl:include href="/data/XSLT/htm-tpl-license.xsl"/>
   <xsl:include href="/data/XSLT/htm-tpl-sqbrackets.xsl"/>
   
   <!-- named templates for localized layout/structure (aka "metadata") -->
   <xsl:include href="/data/XSLT/htm-tpl-structure.xsl"/>
    <xsl:include href="/data/XSLT/htm-tpl-struct-hgv.xsl"/>
    <xsl:include href="/data/XSLT/htm-tpl-struct-inslib.xsl"/>
    <xsl:include href="/data/XSLT/htm-tpl-struct-dol.xsl"/>
   <xsl:include href="/data/XSLT/htm-tpl-struct-rib.xsl"/>
   <xsl:include href="/data/XSLT/htm-tpl-struct-iospe.xsl"/>
    <xsl:include href="/data/XSLT/htm-tpl-struct-edh.xsl"/>
    <xsl:include href="/data/XSLT/htm-tpl-struct-eagle.xsl"/>
    <xsl:include href="/data/XSLT/htm-tpl-struct-igcyr.xsl"/>

   <!-- global named templates with no html, also used by start-txt -->
   <xsl:include href="/data/XSLT/tpl-certlow.xsl"/>
   <xsl:include href="/data/XSLT/tpl-text.xsl"/>



   <!-- HTML FILE -->
   <xsl:template match="/">
      <xsl:choose>
         <xsl:when test="$edn-structure = 'london'">
            <!-- this and other structure templates found in htm-tpl-struct-*.xsl -->
             <xsl:call-template name="london-structure">
                 <xsl:with-param name="parm-internal-app-style" select="$internal-app-style" tunnel="yes"/>
                 <xsl:with-param name="parm-external-app-style" select="$external-app-style" tunnel="yes"/>
                <xsl:with-param name="parm-edn-structure" select="$edn-structure" tunnel="yes"/>
                <xsl:with-param name="parm-edition-type" select="$edition-type" tunnel="yes"/>
                <xsl:with-param name="parm-hgv-gloss" select="$hgv-gloss" tunnel="yes"/>
                <xsl:with-param name="parm-leiden-style" select="$leiden-style" tunnel="yes"/>
                 <xsl:with-param name="parm-line-inc" select="$line-inc" tunnel="yes" as="xs:double"/>
                 <xsl:with-param name="parm-verse-lines" select="$verse-lines" tunnel="yes"/>
                 <xsl:with-param name="parm-css-loc" select="$css-loc" tunnel="yes"/>
            </xsl:call-template>
         </xsl:when>
         <xsl:when test="$edn-structure = 'hgv'">
             <xsl:call-template name="hgv-structure">
                 <xsl:with-param name="parm-internal-app-style" select="$internal-app-style" tunnel="yes"/>
                 <xsl:with-param name="parm-external-app-style" select="$external-app-style" tunnel="yes"/>
                <xsl:with-param name="parm-edn-structure" select="$edn-structure" tunnel="yes"/>
                <xsl:with-param name="parm-edition-type" select="$edition-type" tunnel="yes"/>
                <xsl:with-param name="parm-hgv-gloss" select="$hgv-gloss" tunnel="yes"/>
                <xsl:with-param name="parm-leiden-style" select="$leiden-style" tunnel="yes"/>
                <xsl:with-param name="parm-line-inc" select="$line-inc" tunnel="yes" as="xs:double"/>
                 <xsl:with-param name="parm-verse-lines" select="$verse-lines" tunnel="yes"/>
                 <xsl:with-param name="parm-css-loc" select="$css-loc" tunnel="yes"/>
            </xsl:call-template>
         </xsl:when>
          <xsl:when test="$edn-structure = 'inslib'">
              <xsl:call-template name="inslib-structure">
                  <xsl:with-param name="parm-internal-app-style" select="$internal-app-style" tunnel="yes"/>
                  <xsl:with-param name="parm-external-app-style" select="$external-app-style" tunnel="yes"/>
                  <xsl:with-param name="parm-edn-structure" select="$edn-structure" tunnel="yes"/>
                  <xsl:with-param name="parm-edition-type" select="$edition-type" tunnel="yes"/>
                  <xsl:with-param name="parm-hgv-gloss" select="$hgv-gloss" tunnel="yes"/>
                  <xsl:with-param name="parm-leiden-style" select="$leiden-style" tunnel="yes"/>
                  <xsl:with-param name="parm-line-inc" select="$line-inc" tunnel="yes" as="xs:double"/>
                  <xsl:with-param name="parm-verse-lines" select="$verse-lines" tunnel="yes"/>
                  <xsl:with-param name="parm-css-loc" select="$css-loc" tunnel="yes"/>
              </xsl:call-template>
          </xsl:when>
          <xsl:when test="$edn-structure = 'dol'">
              <xsl:call-template name="dol-structure">
                  <xsl:with-param name="parm-internal-app-style" select="$internal-app-style" tunnel="yes"/>
                  <xsl:with-param name="parm-external-app-style" select="$external-app-style" tunnel="yes"/>
                  <xsl:with-param name="parm-edn-structure" select="$edn-structure" tunnel="yes"/>
                  <xsl:with-param name="parm-edition-type" select="$edition-type" tunnel="yes"/>
                  <xsl:with-param name="parm-hgv-gloss" select="$hgv-gloss" tunnel="yes"/>
                  <xsl:with-param name="parm-leiden-style" select="$leiden-style" tunnel="yes"/>
                  <xsl:with-param name="parm-line-inc" select="$line-inc" tunnel="yes" as="xs:double"/>
                  <xsl:with-param name="parm-verse-lines" select="$verse-lines" tunnel="yes"/>
                  <xsl:with-param name="parm-css-loc" select="$css-loc" tunnel="yes"/>
              </xsl:call-template>
          </xsl:when>
         <xsl:when test="$edn-structure = 'iospe'">
             <xsl:call-template name="iospe-structure">
                 <xsl:with-param name="parm-internal-app-style" select="$internal-app-style" tunnel="yes"/>
                 <xsl:with-param name="parm-external-app-style" select="$external-app-style" tunnel="yes"/>
                <xsl:with-param name="parm-edn-structure" select="$edn-structure" tunnel="yes"/>
                <xsl:with-param name="parm-edition-type" select="$edition-type" tunnel="yes"/>
                <xsl:with-param name="parm-hgv-gloss" select="$hgv-gloss" tunnel="yes"/>
                <xsl:with-param name="parm-leiden-style" select="$leiden-style" tunnel="yes"/>
                <xsl:with-param name="parm-line-inc" select="$line-inc" tunnel="yes" as="xs:double"/>
                 <xsl:with-param name="parm-verse-lines" select="$verse-lines" tunnel="yes"/>
                 <xsl:with-param name="parm-css-loc" select="$css-loc" tunnel="yes"/>
            </xsl:call-template>
         </xsl:when>
         <xsl:when test="$edn-structure = 'ddbdp'">
            <div>
                <xsl:call-template name="default-body-structure">
                    <xsl:with-param name="parm-internal-app-style" select="$internal-app-style" tunnel="yes"/>
                    <xsl:with-param name="parm-external-app-style" select="$external-app-style" tunnel="yes"/>
                  <xsl:with-param name="parm-edn-structure" select="$edn-structure" tunnel="yes"/>
                  <xsl:with-param name="parm-edition-type" select="$edition-type" tunnel="yes"/>
                  <xsl:with-param name="parm-hgv-gloss" select="$hgv-gloss" tunnel="yes"/>
                  <xsl:with-param name="parm-leiden-style" select="$leiden-style" tunnel="yes"/>
                  <xsl:with-param name="parm-line-inc" select="$line-inc" tunnel="yes" as="xs:double"/>
                    <xsl:with-param name="parm-verse-lines" select="$verse-lines" tunnel="yes"/>
                    <xsl:with-param name="parm-css-loc" select="$css-loc" tunnel="yes"/>
              </xsl:call-template>
            </div>
         </xsl:when>
<xsl:when test="$edn-structure='eagle'">
    <xsl:call-template name="eagle-structure">
        <xsl:with-param name="parm-internal-app-style" select="$internal-app-style" tunnel="yes"/>
        <xsl:with-param name="parm-external-app-style" select="$external-app-style" tunnel="yes"/>
        <xsl:with-param name="parm-edn-structure" select="$edn-structure" tunnel="yes"/>
        <xsl:with-param name="parm-edition-type" select="$edition-type" tunnel="yes"/>
        <xsl:with-param name="parm-hgv-gloss" select="$hgv-gloss" tunnel="yes"/>
        <xsl:with-param name="parm-leiden-style" select="$leiden-style" tunnel="yes"/>
        <xsl:with-param name="parm-line-inc" select="$line-inc" tunnel="yes" as="xs:double"/>
        <xsl:with-param name="parm-verse-lines" select="$verse-lines" tunnel="yes"/>
        <xsl:with-param name="parm-css-loc" select="$css-loc" tunnel="yes"/>
        <xsl:with-param name="parm-bib" select="$bibliography" tunnel="yes"/>
        <xsl:with-param name="parm-bibloc" select="$localbibl" tunnel="yes"/>
        <xsl:with-param name="parm-zoteroUorG" select="$ZoteroUorG" tunnel="yes"/>
        <xsl:with-param name="parm-zoteroKey" select="$ZoteroKey" tunnel="yes"/>
        <xsl:with-param name="parm-zoteroNS" select="$ZoteroNS" tunnel="yes"/>
        <xsl:with-param name="parm-zoteroStyle" select="$ZoteroStyle" tunnel="yes"/>
    </xsl:call-template>
</xsl:when>
          <xsl:when test="$edn-structure='igcyr'">
              <xsl:call-template name="igcyr-structure">
                  <xsl:with-param name="parm-internal-app-style" select="$internal-app-style" tunnel="yes"/>
                  <xsl:with-param name="parm-external-app-style" select="$external-app-style" tunnel="yes"/>
                  <xsl:with-param name="parm-edn-structure" select="$edn-structure" tunnel="yes"/>
                  <xsl:with-param name="parm-edition-type" select="$edition-type" tunnel="yes"/>
                  <xsl:with-param name="parm-hgv-gloss" select="$hgv-gloss" tunnel="yes"/>
                  <xsl:with-param name="parm-leiden-style" select="$leiden-style" tunnel="yes"/>
                  <xsl:with-param name="parm-line-inc" select="$line-inc" tunnel="yes" as="xs:double"/>
                  <xsl:with-param name="parm-verse-lines" select="$verse-lines" tunnel="yes"/>
                  <xsl:with-param name="parm-css-loc" select="$css-loc" tunnel="yes"/>
              </xsl:call-template>
          </xsl:when>
          <xsl:otherwise>
             <xsl:call-template name="default-structure">
                 <xsl:with-param name="parm-internal-app-style" select="$internal-app-style" tunnel="yes"/>
                 <xsl:with-param name="parm-external-app-style" select="$external-app-style" tunnel="yes"/>
                <xsl:with-param name="parm-edn-structure" select="$edn-structure" tunnel="yes"/>
                <xsl:with-param name="parm-edition-type" select="$edition-type" tunnel="yes"/>
                <xsl:with-param name="parm-hgv-gloss" select="$hgv-gloss" tunnel="yes"/>
                <xsl:with-param name="parm-leiden-style" select="$leiden-style" tunnel="yes"/>
                <xsl:with-param name="parm-line-inc" select="$line-inc" tunnel="yes" as="xs:double"/>
                 <xsl:with-param name="parm-verse-lines" select="$verse-lines" tunnel="yes"/>
                 <xsl:with-param name="parm-css-loc" select="$css-loc" tunnel="yes"/>
            </xsl:call-template>
         </xsl:otherwise>
      </xsl:choose>
   </xsl:template>



</xsl:stylesheet>
