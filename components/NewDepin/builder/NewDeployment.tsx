/* eslint-disable promise/param-names */
/* eslint-disable @next/next/no-img-element */
/* eslint-disable jsx-a11y/alt-text */
/* eslint-disable react/no-unknown-property */
/* eslint-disable dot-notation */
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable no-unused-vars */
'use client'
// import { useState } from 'react'
import { useEffect, useState, ChangeEvent, FC, useContext, useRef } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { Eye, EyeSlash, SmileySad } from 'phosphor-react'
import * as Yup from 'yup'
import axios from 'axios'
import { toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import 'react-quill/dist/quill.snow.css' // import styles
import 'react-datepicker/dist/react-datepicker.css'
import LottiePlayer from 'react-lottie-player'
import {
  formatDate,
  formatTokenPrice,
  transformString,
  wait,
} from '@/utils/functions'
import { LLMAppProps } from '@/types/llm'
import {
  depinOptionsFeatures,
  depinOptionsNetwork,
  depinPaymentMethodsAccelar,
  depinPaymentMethodsEVM,
} from '@/types/consts/depin'
import Dropdown, { ValueObject } from '@/components/Modals/Dropdown'
import { AccountContext } from '@/contexts/AccountContext'
import { callAxiosBackend } from '@/utils/general-api'
// import EditWorkflowModal from './Modals/EditWorkflowModal'
import { parseCookies } from 'nookies'
import { TypeWalletProvider } from '@/components/IDE/MainPage'
import { BlockchainWalletProps } from '@/types/blockchain-app'
import ConnectButton from '@/contexts/ConnectButton'
import { useAccount, useReadContract } from 'wagmi'
import ConfirmGenericTransaction from '@/components/BlockchainWallets/Modals/ConfirmGenericTransaction'
import { useContractWrite } from '../../IDE/hooks/useContract'
import { Abi } from 'viem'
import { depinABI } from '@/types/consts/depinABI'
import { parseEther } from 'ethers'
import { networkToNetworkRPC } from '@/components/BlockchainWallets/BlockchainWallet.tsx/BlockchainWalletPage'
import CreateACOUserOnboarding from '@/components/Modals/CreateACOUserOnboarding'
import { chainToCopy } from '@/blockchain/utils/chainToMetaData'
import { wagmiConfig } from '@/blockchain/config'

export interface ModalI {
  onUpdate(): void
}

const NewDeployment = ({ onUpdate }: ModalI) => {
  const [isDeleteUserOpen, setIsDeleteUserOpen] = useState<any>()
  const [isEditInfoOpen, setIsEditInfoOpen] = useState<any>()
  const [isEditAppOpen, setIsEditAppOpen] = useState<any>()
  const [deploymentName, setDeploymentName] = useState('')
  const [bidAmount, setBidAmount] = useState('')
  const [isLoading, setIsLoading] = useState(null)
  const [sdlValue, setSDLValue] = useState('')
  const [tokenPrice, setTokenPrice] = useState('0.0')
  const [isLoadingWallets, setIsLoadingWallets] = useState(false)
  const [isDeployed, setIsDeployed] = useState(false)
  const [blockchainWalletsSelected, setBlockchainWalletsSelected] =
    useState<ValueObject>()
  const [selectedNetwork, setSelectedNetwork] = useState<ValueObject>(
    depinOptionsNetwork[0],
  )
  const { acoUser, acoChain } = useContext(AccountContext)

  const [isConfirmTransactionOpen, setIsConfirmTransactionOpen] =
    useState<any>(false)

  const confirmTransactionRef = useRef(null)

  const { address, chain } = useAccount()
  const { write } = useContractWrite()

  const [blockchainWalletsDropdown, setBlockchainWalletsDropdown] =
    useState<ValueObject[]>()
  const [selectedFeature, setSelectedFeature] = useState<ValueObject>(
    depinOptionsFeatures[0],
  )
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<ValueObject>(depinPaymentMethodsAccelar[0])

  const [blockchainWallets, setBlockchainWallets] = useState<
    BlockchainWalletProps[]
  >([])

  const [walletProvider, setWalletProvider] = useState<TypeWalletProvider>(
    TypeWalletProvider.EVM,
  )

  const { workspace, user, isDeployingNewDepinFeature } =
    useContext(AccountContext)

  const { push } = useRouter()
  const pathname = usePathname()

  const menuRef = useRef(null)
  const editRef = useRef(null)

  const closeMenu = () => {
    setIsDeleteUserOpen(false)
  }

  const handleInputChangeName = (e) => {
    if (!isLoading) {
      setDeploymentName(e.target.value)
    }
  }

  const handleInputBidAmount = (e) => {
    if (!isLoading) {
      const value = e.target.value
      // Esta expressão regular permite apenas números
      const regex = /^\d*\.?\d*$/

      if (regex.test(value)) {
        setBidAmount(value)
      }
    }
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        // Clicked outside of the menu, so close it
        closeMenu()
      }
    }

    // Add event listener when the menu is open
    if (isDeleteUserOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    } else {
      // Remove event listener when the menu is closed
      document.removeEventListener('mousedown', handleClickOutside)
    }

    // Clean up the event listener when the component unmounts
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDeleteUserOpen])

  function handleClickApp(id: string, event) {
    console.log('cliquei no app ism')
    if (!editRef?.current?.contains(event.target)) {
      push(`${pathname}/${id}`)
    }
  }

  function formChecks() {
    if (
      deploymentName?.length > 0 &&
      sdlValue?.length > 0 &&
      bidAmount?.length > 0
    ) {
      if (
        walletProvider === TypeWalletProvider?.ACCELAR &&
        blockchainWalletsSelected
      ) {
        return true
      } else if (
        walletProvider === TypeWalletProvider?.EVM &&
        address?.length > 0
      ) {
        return true
      }
    }
    return false
  }

  const handleAccelarDeployment = async () => {
    if (!formChecks()) {
      toast.error('Complete the form')
      return
    }
    if (selectedPaymentMethod.value === 'pix') {
      toast.error('Pix paymenths is disable for this hour in Brazil')
      return
    }
    setIsLoading(true)

    const { userSessionToken } = parseCookies()

    const data = {
      walletId: blockchainWalletsSelected.value,
      name: deploymentName,
      bidAmount,
      network: selectedNetwork?.value,
      depinFeature: 'AKASH',
      sdl: sdlValue,
    }

    try {
      const res = await callAxiosBackend(
        'post',
        '/blockchain/depin/functions/createDeploymentOrder',
        userSessionToken,
        data,
      )
      toast.success(`Order created`)
      console.log(res)
      onUpdate()
      //   startCheckOrder(res.id)
      setIsLoading(false)
    } catch (err) {
      console.log(err)
      toast.error(`Error: ${err.response.data.message}`)
      setIsLoading(false)
    }
  }

  type NFTIds = bigint[]
  const { data: nftIds, refetch: refetchNftIds } = useReadContract({
    address: chainToCopy[acoChain]?.contractAddress,
    config: wagmiConfig,
    abi: depinABI,
    functionName: 'getAllNFTIds',
    args: [address], // O endereço do usuário atual
  })

  const handleEVMDeployment = async () => {
    if (!formChecks()) {
      toast.error('Complete the form')
      return
    }
    if (!address) {
      toast.error('Address not found')
      return
    }
    setIsLoading(true)

    const dataApi = {
      sdl: sdlValue,
    }

    const addressTointeract = address
    try {
      let resData
      try {
        resData = await callAxiosBackend(
          'post',
          '/blockchain/depin/functions/uploadDeploymentSdl',
          'userSessionToken',
          dataApi,
        )
      } catch (err) {
        toast.error('Error: SDL invalid')
        throw err
      }

      console.log('passei resd data')
      console.log(resData)
      const url = `https://ipfs.io/ipfs/${resData?.IpfsHash}`
      const bidAmountWei = parseEther(bidAmount)
      console.log(String(bidAmountWei))
      console.log(url)
      console.log(addressTointeract)
      console.log(chainToCopy[acoChain]?.contractAddress)
      console.log(chain)
      const res = await write(
        'createDeployment',
        [
          // `https://api.accelar.io/blockchain/depin/functions/getSdlByDeploymentId?id=${url.id}`,
          url,
          addressTointeract,
        ],
        depinABI as Abi,
        chain,
        addressTointeract,
        chainToCopy[acoChain]?.contractAddress,
        String(bidAmountWei),
      )
      await wait(2000)
      await refetchNftIds()
      let lastTokenId
      // O último NFT ID será o mais recente
      if (nftIds && (nftIds as any).length > 0) {
        lastTokenId = nftIds[(nftIds as any).length - 1]
        console.log('Último NFT criado com tokenId:', lastTokenId.toString())
      }

      console.log('A resss')
      console.log(res)
      const dataDeployment = {
        name: deploymentName,
        evmHash: res?.transactionHash,
        evmAddress: address,
        tokenId: lastTokenId.toString(),
        chain: 'educhain',
      }

      const timeout = (ms: number) =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), ms),
        )

      try {
        // Use Promise.race para competir entre a chamada da API e o timeout
        const resData2 = await Promise.race([
          callAxiosBackend(
            'post',
            '/blockchain/depin/functions/storeDeployment',
            'userSessionToken',
            dataDeployment,
          ),
          timeout(5000), // 5 segundos de timeout
        ])

        console.log('Deployment stored successfully:', resData2)
      } catch (error) {
        if (error.message === 'Timeout') {
          console.log('Storing deployment timed out, but continuing...')
        } else {
          console.error('Error storing deployment:', error)
        }
      }
      toast.success(
        'Success, your deployment may take up to 30 minutes to complete',
      )
      await wait(3000)
      push('/feats/depin')
      onUpdate()
      setIsLoading(false)
    } catch (err) {
      console.log(err)
      console.log('Error: ' + err?.response?.data?.message)
      setIsLoading(false)
    }
  }

  const handleCreateDeployment = async () => {
    if (walletProvider === TypeWalletProvider.ACCELAR) {
      handleAccelarDeployment()
    } else if (walletProvider === TypeWalletProvider.EVM) {
      handleEVMDeployment()
    }
  }

  async function getWallets() {
    setIsLoadingWallets(true)
    const { userSessionToken } = parseCookies()

    try {
      const res = await callAxiosBackend(
        'get',
        `/blockchain/functions/getWorkspaceWallets?id=${workspace.id}&${
          networkToNetworkRPC[selectedNetwork?.value3].name
        }=${
          networkToNetworkRPC[selectedNetwork?.value3]?.value[
            selectedNetwork?.value4
          ]
        }&network=${selectedNetwork?.value3}`,
        userSessionToken,
      )
      const walletsToSet = []
      for (let i = 0; i < res?.length; i++) {
        walletsToSet.push({
          name: transformString(res[i][selectedNetwork.value5], 5),
          value: res[i].id,
        })
      }
      setBlockchainWalletsDropdown(walletsToSet)
      setBlockchainWallets(res)
      if (walletsToSet?.length > 0) {
        setBlockchainWalletsSelected(walletsToSet[0])
      }
    } catch (err) {
      console.log(err)
      toast.error(`Error: ${err.response.data.message}`)
    }
    setIsLoadingWallets(false)
    setIsLoading(false)
  }

  const getDeploymentPrice = async () => {
    setTokenPrice('loading')
    const { userSessionToken } = parseCookies()

    try {
      const res = await callAxiosBackend(
        'get',
        `/blockchain/depin/functions/getDeploymentPrice?network=FRAXTAL_MAINNET&depinFeature=AKASH`,
        userSessionToken,
      )
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setTokenPrice(String(res.price))
    } catch (err) {
      console.log(err)
      toast.error(`Error getting symbol price`)
    }
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        confirmTransactionRef.current &&
        !confirmTransactionRef.current.contains(event.target)
      ) {
        setIsConfirmTransactionOpen(false)
      }
    }

    if (isConfirmTransactionOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    } else {
      document.removeEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isConfirmTransactionOpen])

  useEffect(() => {
    let intervalId
    if (isDeployingNewDepinFeature) {
      getWallets()
      getDeploymentPrice()
      intervalId = setInterval(() => {
        getDeploymentPrice()
      }, 180000)
    }
    return () => clearInterval(intervalId)
  }, [isDeployingNewDepinFeature])

  if (!acoUser) {
    return (
      <CreateACOUserOnboarding
        onUpdateM={() => {
          console.log('update')
        }}
      />
    )
  }

  if (isDeployed) {
    return (
      <div className="text-center text-[24px] font-medium text-white">
        <div>Deployment under proccess</div>
        <div className="mt-4 text-[14px] text-gray">
          The deployment process takes up to 10 minutes, you may close this
          window now.
        </div>
        <div className="mx-auto w-[200px]">
          <LottiePlayer
            loop
            animationData={require('./animation.json')}
            play
            style={{ width: '100%', height: 'auto' }}
          />
        </div>
        <a href="/feats/depin">
          <div className="mx-auto w-fit cursor-pointer rounded-md bg-[#4766EA] px-5 py-1 text-[14px] text-white hover:bg-[#3A51B0]">
            Go to Dashboard
          </div>
        </a>
      </div>
    )
  }

  return (
    <div className="relative grid gap-y-[25px] text-[14px] font-normal text-[#C5C4C4]">
      <div className="absolute -right-16 top-56 z-[-1] rotate-180 opacity-20">
        <img src="/images/video/shape.svg" alt="shape" className="w-full" />
      </div>

      <div className="flex justify-center gap-x-20 pb-4 pt-16">
        <div className="w-[50%]">
          <div className="relative mb-6">
            <div className="absolute -top-16 flex items-center gap-x-4">
              <div className="text-2xl  text-white">New deployment</div>
            </div>
            <label
              htmlFor="workspaceName"
              className="mb-2 block text-[14px] text-[#C5C4C4]"
            >
              Name*
            </label>
            <input
              type="text"
              maxLength={50}
              id="workspaceName"
              name="workspaceName"
              value={deploymentName}
              onChange={handleInputChangeName}
              className="w-[400px] rounded-md border border-transparent px-6 py-1 text-base text-body-color placeholder-body-color  outline-none focus:border-primary  dark:bg-[#242B51]"
            />
          </div>{' '}
          <div className="mb-6">
            <label
              htmlFor="workspaceName"
              className="mb-2 block text-[14px] text-[#C5C4C4]"
            >
              Feature
            </label>
            <div className="text-base">
              <Dropdown
                optionSelected={selectedFeature}
                options={depinOptionsFeatures}
                onValueChange={(value) => {
                  setSelectedFeature(value)
                }}
                classNameForDropdown="!min-w-[150px] !px-3 !py-1 !w-fit"
                classNameForPopUp="!px-3"
              />
            </div>
          </div>
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <label
                htmlFor="workspaceName"
                className="mb-2 block text-[14px] text-[#C5C4C4]"
              >
                SDL*
              </label>
              <a
                href="https://console.akash.network/templates"
                target="_blank"
                rel="noreferrer"
              >
                <div className="cursor-pointer text-[14px] text-blue hover:text-hoverBlue">
                  Templates
                </div>
              </a>
            </div>
            <textarea
              onChange={(e) => {
                setSDLValue(e.target.value)
              }}
              className="h-[130px] w-full rounded-md border border-transparent px-6 py-2 text-sm text-white placeholder-body-color outline-none focus:border-primary  dark:bg-[#242B51] 2xl:h-[230px]"
            >
              {' '}
            </textarea>{' '}
          </div>
          <div className="mb-2 flex gap-x-2">
            <div className="">Estimated price:</div>
            {tokenPrice === 'loading' ? (
              <div className="h-5 w-32 animate-pulse rounded-[5px] bg-[#1d2144b0]"></div>
            ) : (
              <div>{chainToCopy[acoChain]?.depinDplEstPrice}</div>
            )}
          </div>
          <div className="mb-6">
            <label
              htmlFor="workspaceName"
              className="mb-2 block text-[14px] text-[#C5C4C4]"
            >
              Amount to bid* ({chainToCopy[acoChain]?.currency})
            </label>
            <input
              type="text"
              maxLength={50}
              id="workspaceName"
              name="workspaceName"
              value={bidAmount}
              onChange={handleInputBidAmount}
              className="w-[400px] rounded-md border border-transparent px-6 py-1 text-base text-body-color placeholder-body-color  outline-none focus:border-primary  dark:bg-[#242B51]"
            />
          </div>{' '}
          <div className="relative mt-10 w-[320px]">
            <div
              className={`
                ${
                  formChecks()
                    ? `${
                        isLoading
                          ? 'animate-pulse !bg-[#35428a]'
                          : 'cursor-pointer  hover:bg-[#35428a]'
                      } `
                    : `!cursor-auto !bg-[#4f5b9bbb]`
                } w-fit rounded-[5px] bg-[#273687] p-[4px] px-[15px] text-[14px] text-[#fff]
                 `}
              onClick={() => {
                if (!isLoading && formChecks()) {
                  handleCreateDeployment()
                }
              }}
            >
              Create Deployment
            </div>
            {isConfirmTransactionOpen && (
              <div
                ref={confirmTransactionRef}
                className="absolute right-0 top-0 w-fit -translate-y-[100%] translate-x-[50%]"
              >
                <ConfirmGenericTransaction
                  description="You are going to create a deployment order request"
                  onConfirmTransaction={() => {
                    handleCreateDeployment()
                    setIsConfirmTransactionOpen(false)
                  }}
                />
              </div>
            )}
          </div>
        </div>
        <div>
          <div className="mb-6">
            <label
              htmlFor="workspaceName"
              className="mb-2 block text-[14px] text-[#C5C4C4]"
            >
              Wallet provider*
            </label>
            <div className="mb-3 mt-1 flex h-fit w-fit gap-x-[1px] rounded-xl bg-[#242B51] px-1 py-1">
              <div
                onClick={() => {
                  setSelectedPaymentMethod(depinPaymentMethodsEVM[0])
                  setWalletProvider(TypeWalletProvider.EVM)
                }}
                className={`cursor-pointer rounded-xl px-2 py-1 ${
                  walletProvider === TypeWalletProvider.EVM && 'bg-[#dbdbdb1e]'
                }`}
              >
                Metamask
              </div>
              <div
                onClick={() => {
                  setWalletProvider(TypeWalletProvider.ACCELAR)
                  getWallets()
                }}
                className={`cursor-pointer rounded-xl px-2 py-1 ${
                  walletProvider === TypeWalletProvider.ACCELAR &&
                  'bg-[#dbdbdb1e]'
                }`}
              >
                Accelar
              </div>
            </div>
            {walletProvider === TypeWalletProvider.ACCELAR && (
              <div>
                {isLoadingWallets ? (
                  <div className="mb-2 flex h-[25px] w-[150px] animate-pulse rounded-md bg-[#dbdbdb1e]"></div>
                ) : (
                  <>
                    <label className="flex w-fit items-center gap-x-1 text-[#FE886D]">
                      Not available
                    </label>
                    {blockchainWalletsSelected && (
                      <div className="mt-2 text-[12px] text-[#c5c4c4]">
                        {' '}
                        Balance:{' '}
                        {
                          blockchainWallets?.find(
                            (obj) => obj.id === blockchainWalletsSelected.value,
                          )?.balance
                        }
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {walletProvider === TypeWalletProvider.EVM && (
              <div className="flex gap-x-2">
                <div className="">
                  <ConnectButton />
                </div>
                <div>
                  {address && chain?.id !== chainToCopy[acoChain]?.chainId && (
                    <div className="text-[#c22336]">
                      * Change network to {chainToCopy[acoChain]?.name}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="mb-6">
            <label
              htmlFor="workspaceName"
              className="mb-2 block text-[14px] text-[#C5C4C4]"
            >
              Payment method
            </label>
            <div className="text-base">
              <Dropdown
                optionSelected={selectedPaymentMethod}
                options={
                  walletProvider === TypeWalletProvider.ACCELAR
                    ? depinPaymentMethodsAccelar
                    : depinPaymentMethodsEVM
                }
                onValueChange={(value) => {
                  setSelectedPaymentMethod(value)
                }}
                classNameForDropdown="!min-w-[280px] !px-2 !py-1 !w-fit"
                classNameForPopUp="!px-3"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NewDeployment
