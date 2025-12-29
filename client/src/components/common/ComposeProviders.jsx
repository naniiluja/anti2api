/**
 * ComposeProviders - Utility component to reduce provider nesting (Wrapper Hell)
 *
 * Instead of:
 *   <A><B><C><D>{children}</D></C></B></A>
 *
 * Use:
 *   <ComposeProviders providers={[A, B, C, D]}>{children}</ComposeProviders>
 */
const ComposeProviders = ({ providers = [], children }) => {
  return providers.reduceRight(
    (acc, Provider) => <Provider>{acc}</Provider>,
    children
  );
};

export default ComposeProviders;
